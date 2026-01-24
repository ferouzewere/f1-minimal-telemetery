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
  telemetry: TelemetryFrame[];
}

interface RaceData {
  race_name: string;
  year: number;
  circuit: string;
  drivers: DriverData[];
}

interface RaceState {
  currentTime: number;
  playSpeed: number;
  isPlaying: boolean;
  raceData: RaceData | null;
  focusedDriver: string | null;

  // Actions
  loadRaceData: (data: RaceData) => void;
  setCurrentTime: (time: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setFocusedDriver: (abbr: string | null) => void;
}

export const useRaceStore = create<RaceState>((set) => ({
  currentTime: 0,
  playSpeed: 1,
  isPlaying: false,
  raceData: null,
  focusedDriver: null,

  loadRaceData: (data) => {
    if (!data || !data.drivers || data.drivers.length === 0) return;
    set({
      raceData: data,
      currentTime: 0,
      focusedDriver: data.drivers[0].driver_abbr
    });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setPlaySpeed: (speed) => set({ playSpeed: speed }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seekTo: (time) => set({ currentTime: time }),

  setFocusedDriver: (abbr) => set({ focusedDriver: abbr }),
}));
