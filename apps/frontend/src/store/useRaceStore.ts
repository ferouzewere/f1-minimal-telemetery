import { setCachedData } from '../utils/db';
import { create } from 'zustand';
import { getInterpolatedFrame } from '../utils/interpolation';

export interface TelemetryFrame {
  t: number;
  lap: number;
  dist: number;
  speed: number;
  rpm: number; // Added RPM
  gear: number;
  throttle: number;
  brake: number;
  x: number;
  y: number;
  compound: string;
  tyre_age: number;
  is_pit: boolean;
  drs: number;
  ax?: number;
  ay?: number;
  is_active?: boolean;
}

interface Stint {
  compound: string;
  stint: number;
  start_lap: number;
  count: number;
}

export interface DriverData {
  driver_abbr: string;
  driver_name: string;
  team: string;
  team_color?: string; // Added Team Color
  stints: Stint[];
  lapTimes: Record<number, number>; // lap number -> lap time in ms
  sectorTimes: Record<number, { s1: number; s2: number; s3: number }>; // lap -> sector times
  personalBests: { s1: number; s2: number; s3: number };
  telemetry: TelemetryFrame[];
}

export interface WeatherFrame {
  t: number;
  air_temp: number;
  track_temp: number;
  humidity: number;
  rainfall: boolean;
  wind_speed: number;
  wind_direction: number;
}

export interface TrackStatusFrame {
  t: number;
  status: string;
  message?: string;
}

interface RaceData {
  race_name: string;
  year: number;
  circuit: string;
  weather?: WeatherFrame[];
  track_status?: TrackStatusFrame[];
  drivers: DriverData[];
}

interface SessionBests {
  s1: number;
  s2: number;
  s3: number;
}

interface PitStop {
  driver_abbr: string;
  lap: number;
  timestamp: number;
}

export interface CircuitMetadata {
  id: string;
  name: string;
  location: string;
  lapLength: number;
  sectors: {
    s1_end: number;
    s2_end: number;
  };
}

export interface BackgroundJob {
  id: string;
  name: string;
  progress: number;
  status: 'initializing' | 'syncing' | 'completed' | 'failed';
  message: string;
}

interface RaceState {
  currentTime: number;
  playSpeed: number;
  isPlaying: boolean;
  raceData: RaceData | null;
  focusedDriver: string | null;
  comparisonDriver: string | null;
  trackLength: number;
  circuitMetadata: CircuitMetadata | null;
  sessionBests: SessionBests;
  totalLaps: number;
  pitStops: PitStop[];
  sessionBestLap: number; // Lowest lap time in ms
  currentWeather: WeatherFrame | null;
  currentTrackStatus: TrackStatusFrame | null;
  driverFrames: Record<string, TelemetryFrame | null>;
  lastIndices: Record<string, number>;
  leaderAbbr: string | null;
  activeJobs: BackgroundJob[];
  bridgeStatus: 'online' | 'offline' | 'checking';

  // Actions
  loadRaceData: (data: RaceData, metadata?: CircuitMetadata, cacheKey?: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setFocusedDriver: (abbr: string | null) => void;
  setComparisonDriver: (abbr: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  addJob: (job: BackgroundJob) => void;
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void;
  removeJob: (id: string) => void;
  setBridgeStatus: (status: 'online' | 'offline' | 'checking') => void;
}

export const useRaceStore = create<RaceState>((set, get) => ({
  currentTime: 0,
  playSpeed: 1,
  isPlaying: false,
  raceData: null,
  focusedDriver: null,
  comparisonDriver: null,
  trackLength: 3337, // Monaco default
  circuitMetadata: null,
  sessionBests: { s1: Infinity, s2: Infinity, s3: Infinity },
  totalLaps: 0,
  pitStops: [],
  sessionBestLap: Infinity,
  currentWeather: null,
  currentTrackStatus: null,
  driverFrames: {},
  lastIndices: {},
  leaderAbbr: null,
  activeJobs: [],
  bridgeStatus: 'checking',

  loadRaceData: (data, metadata, cacheKey) => {
    if (!data || !data.drivers || data.drivers.length === 0) return;

    // 0. Update Metadata if provided (Synchronous)
    if (metadata) {
      set({ circuitMetadata: metadata, trackLength: metadata.lapLength });
    } else {
      set({ trackLength: 3337 });
    }

    // 1. Offload to Worker
    const worker = new Worker(new URL('../workers/raceWorker.ts', import.meta.url), { type: 'module' });

    worker.postMessage({ data, metadata });

    worker.onmessage = (e) => {
      const { raceData, calculatedLength, sessionSectorBest, maxLap, pitStops, sessionBest } = e.data;

      set({
        raceData,
        currentTime: 0,
        focusedDriver: null,
        comparisonDriver: null,
        trackLength: calculatedLength,
        sessionBests: sessionSectorBest,
        totalLaps: maxLap,
        pitStops,
        sessionBestLap: sessionBest,
        driverFrames: {},
        lastIndices: {},
        leaderAbbr: null
      });

      if (cacheKey) {
        setCachedData(cacheKey, { raceData });
      }

      // Initialize positions immediately
      get().setCurrentTime(0);

      worker.terminate();
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      worker.terminate();
    };
  },

  setCurrentTime: (time) => {
    set((state) => {
      if (!state.raceData) return { currentTime: time };

      // 1. Weather/Status (as before)
      let weather = state.currentWeather;
      if (state.raceData.weather) {
        weather = state.raceData.weather.reduce((prev, curr) =>
          (curr.t <= time && curr.t > (prev?.t || -1)) ? curr : prev, null as WeatherFrame | null);
      }

      let status = state.currentTrackStatus;
      if (state.raceData.track_status) {
        status = state.raceData.track_status.reduce((prev, curr) =>
          (curr.t <= time && curr.t > (prev?.t || -1)) ? curr : prev, null as TrackStatusFrame | null);
      }

      // 2. Parallel Driver Frame Calculation with Index Hinting
      const nextFrames: Record<string, TelemetryFrame> = {};
      const nextIndices: Record<string, number> = { ...state.lastIndices };
      let leaderAbbr: string | null = null;
      let maxTotalDist = -1;

      state.raceData.drivers.forEach(driver => {
        const result = getInterpolatedFrame(
          driver.telemetry,
          time,
          state.lastIndices[driver.driver_abbr] || 0
        );

        // Check for DNF / Inactive (buffer of 10s after last data point)
        const lastPacketTime = driver.telemetry[driver.telemetry.length - 1]?.t || 0;
        const isActive = time <= lastPacketTime + 10000;

        nextFrames[driver.driver_abbr] = { ...result.frame, is_active: isActive };
        nextIndices[driver.driver_abbr] = result.index;

        // 3. Leader Calculation (Optimized: single pass)
        // Only consider active drivers for leader calculation to avoid ghosts leading
        if (isActive) {
          const totalDist = (result.frame.lap - 1) * state.trackLength + result.frame.dist;
          if (totalDist > maxTotalDist) {
            maxTotalDist = totalDist;
            leaderAbbr = driver.driver_abbr;
          }
        }
      });

      return {
        currentTime: time,
        currentWeather: weather,
        currentTrackStatus: status,
        driverFrames: nextFrames,
        lastIndices: nextIndices,
        leaderAbbr
      };
    });
  },
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seekTo: (time) => get().setCurrentTime(time),
  setFocusedDriver: (abbr) => set({ focusedDriver: abbr }),
  setComparisonDriver: (abbr) => set({ comparisonDriver: abbr }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addJob: (job) => set((state) => ({
    activeJobs: [...state.activeJobs.filter(j => j.id !== job.id), job]
  })),
  updateJob: (id, updates) => set((state) => ({
    activeJobs: state.activeJobs.map(j => j.id === id ? { ...j, ...updates } : j)
  })),
  removeJob: (id) => set((state) => ({
    activeJobs: state.activeJobs.filter(j => j.id !== id)
  })),
  setBridgeStatus: (status) => set({ bridgeStatus: status }),
}));
