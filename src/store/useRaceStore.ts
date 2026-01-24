import { create } from 'zustand';

export interface TelemetryFrame {
  t: number;
  lap: number;
  dist: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
  x: number;
  y: number;
  compound: string;
  tyre_age: number;
  is_pit: boolean;
  drs: number;
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
  stints: Stint[];
  lapTimes: Record<number, number>; // lap number -> lap time in ms
  telemetry: TelemetryFrame[];
}

interface RaceData {
  race_name: string;
  year: number;
  circuit: string;
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

interface RaceState {
  currentTime: number;
  playSpeed: number;
  isPlaying: boolean;
  raceData: RaceData | null;
  focusedDriver: string | null;
  trackLength: number;
  sessionBests: SessionBests;
  totalLaps: number;
  pitStops: PitStop[];

  // Actions
  loadRaceData: (data: RaceData) => void;
  setCurrentTime: (time: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setFocusedDriver: (abbr: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const useRaceStore = create<RaceState>((set) => ({
  currentTime: 0,
  playSpeed: 1,
  isPlaying: false,
  raceData: null,
  focusedDriver: null,
  trackLength: 3337, // Monaco approx length
  sessionBests: { s1: Infinity, s2: Infinity, s3: Infinity },
  totalLaps: 0,
  pitStops: [],

  loadRaceData: (data) => {
    if (!data || !data.drivers || data.drivers.length === 0) return;

    // 1. REPAIR TELEMETRY: Handle non-monotonic timestamps (resets)
    // This is critical for binary search and duration calculation
    data.drivers.forEach(driver => {
      let offset = 0;
      let lastRawT = -1;

      driver.telemetry.forEach((frame) => {
        // If we see a jump backwards of more than 10 seconds, assume a reset
        if (lastRawT !== -1 && frame.t < lastRawT - 10000) {
          offset += lastRawT + 1000; // Add 1s gap
        }
        lastRawT = frame.t;
        frame.t += offset;
      });
    });

    // 2. Calculate track length
    const firstDriver = data.drivers[0];
    const lapLengths = firstDriver.telemetry
      .filter(f => f.lap === 1)
      .map(f => f.dist);
    const calculatedLength = Math.max(...lapLengths) || 3337;

    // 4. Calculate total laps, max race duration, and capture lap times
    let maxLap = 0;
    let maxT = 0;

    data.drivers.forEach(driver => {
      const driverLapTimes: Record<number, number> = {};
      let lapStartTime = -1;
      let currentLapNum = -1;

      driver.telemetry.forEach(frame => {
        if (frame.lap > maxLap) maxLap = frame.lap;
        if (frame.t > maxT) maxT = frame.t;

        // Lap transition detection
        if (frame.lap !== currentLapNum) {
          if (currentLapNum !== -1 && lapStartTime !== -1) {
            // Previous lap finished
            const lapDuration = frame.t - lapStartTime;
            driverLapTimes[currentLapNum] = lapDuration;
          }
          currentLapNum = frame.lap;
          lapStartTime = frame.t;
        }
      });

      // Handle the last lap in the data
      const lastFrame = driver.telemetry[driver.telemetry.length - 1];
      if (lastFrame && lapStartTime !== -1) {
        driverLapTimes[lastFrame.lap] = lastFrame.t - lapStartTime;
      }

      driver.lapTimes = driverLapTimes;
    });

    // 5. Extract pit stop events
    const pitStops: PitStop[] = [];
    data.drivers.forEach(driver => {
      let inPit = false;
      driver.telemetry.forEach((frame) => {
        if (frame.is_pit && !inPit) {
          // Entering pit
          pitStops.push({
            driver_abbr: driver.driver_abbr,
            lap: frame.lap,
            timestamp: frame.t
          });
          inPit = true;
        } else if (!frame.is_pit && inPit) {
          // Exiting pit
          inPit = false;
        }
      });
    });

    // Pre-calculate session best sectors (mock logic for POC or real analysis)
    const sessionBests = { s1: 200, s2: 200, s3: 200 }; // km/h (speed bests for POC)

    set({
      raceData: data,
      currentTime: 0,
      focusedDriver: data.drivers[0].driver_abbr,
      trackLength: calculatedLength,
      sessionBests,
      totalLaps: maxLap,
      pitStops
    });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setPlaySpeed: (speed) => set({ playSpeed: speed }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seekTo: (time) => set({ currentTime: time }),

  setFocusedDriver: (abbr) => set({ focusedDriver: abbr }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));
