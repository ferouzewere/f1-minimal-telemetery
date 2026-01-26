import { setCachedData } from '../utils/db';
import { create } from 'zustand';

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

  // Actions
  loadRaceData: (data: RaceData, metadata?: CircuitMetadata, cacheKey?: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setFocusedDriver: (abbr: string | null) => void;
  setComparisonDriver: (abbr: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const useRaceStore = create<RaceState>((set) => ({
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
        sessionBestLap: sessionBest
      });

      if (cacheKey) {
        setCachedData(cacheKey, { raceData });
      }

      worker.terminate();
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      worker.terminate();
    };
  },

  setCurrentTime: (time) => {
    set((state) => {
      // Find current weather and track status
      let weather = state.currentWeather;
      if (state.raceData?.weather) {
        weather = state.raceData.weather.reduce((prev, curr) =>
          (curr.t <= time && curr.t > (prev?.t || -1)) ? curr : prev, null as WeatherFrame | null);
      }

      let status = state.currentTrackStatus;
      if (state.raceData?.track_status) {
        status = state.raceData.track_status.reduce((prev, curr) =>
          (curr.t <= time && curr.t > (prev?.t || -1)) ? curr : prev, null as TrackStatusFrame | null);
      }

      return {
        currentTime: time,
        currentWeather: weather,
        currentTrackStatus: status
      };
    });
  },
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seekTo: (time) => set({ currentTime: time }),
  setFocusedDriver: (abbr) => set({ focusedDriver: abbr }),
  setComparisonDriver: (abbr) => set({ comparisonDriver: abbr }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));
