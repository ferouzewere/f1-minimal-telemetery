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
  loadRaceData: (data: RaceData, metadata?: CircuitMetadata) => void;
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

  loadRaceData: (data, metadata) => {
    if (!data || !data.drivers || data.drivers.length === 0) return;

    // 0. Update Metadata if provided
    if (metadata) {
      set({ circuitMetadata: metadata, trackLength: metadata.lapLength });
    } else {
      set({ trackLength: 3337 });
    }

    // 1. REPAIR TELEMETRY: Handle non-monotonic timestamps (resets)
    data.drivers.forEach(driver => {
      let offset = 0;
      let lastRawT = -1;

      driver.telemetry.forEach((frame) => {
        if (lastRawT !== -1 && frame.t < lastRawT - 10000) {
          offset += lastRawT + 1000; // Add 1s gap
        }
        lastRawT = frame.t;
        frame.t += offset;
      });
    });

    // 2. Track length
    const lapLength = metadata?.lapLength || 3337;
    const firstDriver = data.drivers[0];
    const lapLengths = firstDriver.telemetry
      .filter(f => f.lap === 1)
      .map(f => f.dist);
    const calculatedLength = metadata?.lapLength || Math.max(...lapLengths) || lapLength;

    // 4. Calculate total laps, max race duration, and capture lap times
    let maxLap = 0;
    let maxT = 0;
    let sessionBest = Infinity;

    data.drivers.forEach(driver => {
      const driverLapTimes: Record<number, number> = {};
      let lapStartTime = -1;
      let currentLapNum = -1;

      driver.telemetry.forEach(frame => {
        if (frame.lap > maxLap) maxLap = frame.lap;
        if (frame.t > maxT) maxT = frame.t;

        if (frame.lap !== currentLapNum) {
          if (currentLapNum !== -1 && lapStartTime !== -1) {
            const lapDuration = frame.t - lapStartTime;
            driverLapTimes[currentLapNum] = lapDuration;
            if (lapDuration < sessionBest) sessionBest = lapDuration;
          }
          currentLapNum = frame.lap;
          lapStartTime = frame.t;
        }
      });

      const lastFrame = driver.telemetry[driver.telemetry.length - 1];
      if (lastFrame && lapStartTime !== -1) {
        const lastLapDuration = lastFrame.t - lapStartTime;
        driverLapTimes[lastFrame.lap] = lastLapDuration;
        if (lastLapDuration < sessionBest) sessionBest = lastLapDuration;
      }

      driver.lapTimes = driverLapTimes;
    });

    const pitStops: PitStop[] = [];
    data.drivers.forEach(driver => {
      let inPit = false;
      driver.telemetry.forEach((frame) => {
        if (frame.is_pit && !inPit) {
          pitStops.push({
            driver_abbr: driver.driver_abbr,
            lap: frame.lap,
            timestamp: frame.t
          });
          inPit = true;
        } else if (!frame.is_pit && inPit) {
          inPit = false;
        }
      });
    });

    set({
      raceData: data,
      currentTime: 0,
      focusedDriver: null,
      comparisonDriver: null,
      trackLength: calculatedLength,
      sessionBests: { s1: 200, s2: 200, s3: 200 },
      totalLaps: maxLap,
      pitStops,
      sessionBestLap: sessionBest
    });
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
