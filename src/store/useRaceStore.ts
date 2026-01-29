import { setCachedData } from '../utils/db';
import { create } from 'zustand';
import { getInterpolatedFrame, snapToTrack } from '../utils/interpolation';

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
  track_path?: string;
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

  // Live Mode
  isLive: boolean;
  isHistorical: boolean;
  openF1SessionKey: number | null;
  lastLiveDate: string | null;
  driverMap: Record<number, string>; // number -> abbr
  trackLayout: { x: number, y: number, dist: number }[];

  // Actions
  setTrackLayout: (layout: { x: number, y: number, dist: number }[]) => void;
  loadRaceData: (data: RaceData, metadata?: CircuitMetadata, cacheKey?: string) => void;
  syncDrivers: (drivers: any[]) => void;
  setCurrentTime: (time: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setFocusedDriver: (abbr: string | null) => void;
  setComparisonDriver: (abbr: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  startLiveSession: (sessionKey: number, metadata?: CircuitMetadata, provisionedData?: any) => void;
  appendLiveData: (data: { telemetry: any[], location: any[], weather: any[] }) => void;
  stopLive: () => void;
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
  isLive: false,
  isHistorical: false,
  openF1SessionKey: null,
  lastLiveDate: null,
  driverMap: {},
  trackLayout: [],

  setTrackLayout: (layout) => set({ trackLayout: layout }),

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
      const nextFrames: Record<string, TelemetryFrame | null> = {};
      const nextIndices: Record<string, number> = { ...state.lastIndices };
      let leaderAbbr: string | null = null;
      let maxTotalDist = -1;

      const raceData = state.raceData; // Capture for type narrowing in callbacks

      raceData.drivers.forEach(driver => {
        const result = getInterpolatedFrame(
          driver.telemetry,
          time,
          state.lastIndices[driver.driver_abbr] || 0
        );

        let frame = result.frame;

        // If no telemetry yet, provide a dummy 'stub' frame to initialize UI elements
        if (!frame) {
          const trackLayout = state.trackLayout;
          const driverIdx = raceData.drivers.findIndex(d => d.driver_abbr === driver.driver_abbr);

          let x = 500;
          let y = 350;
          let distOnLap = 0;

          if (trackLayout.length > 0) {
            const totalTrackDist = trackLayout[trackLayout.length - 1].dist;
            const targetDistBack = (driverIdx + 1) * 12; // ~12 units back per car
            const targetAbsDist = totalTrackDist - targetDistBack;

            const gridPoint = trackLayout.reduce((prev, curr) =>
              Math.abs(curr.dist - targetAbsDist) < Math.abs(prev.dist - targetAbsDist) ? curr : prev
              , trackLayout[0]);

            x = gridPoint.x;
            y = gridPoint.y;
            distOnLap = gridPoint.dist;
          }

          frame = {
            t: time,
            lap: 1,
            dist: distOnLap,
            speed: 0,
            rpm: 0,
            gear: 0,
            throttle: 0,
            brake: 0,
            x,
            y,
            compound: 'UNKNOWN',
            tyre_age: 0,
            is_pit: true,
            drs: 0
          };
        }

        // 2.5 Path Snapping: If track layout is available, snap the car to the center line
        if (state.trackLayout.length > 0 && !frame.is_pit) {
          const snapped = snapToTrack(frame.x, frame.y, state.trackLayout);
          frame = { ...frame, x: snapped.x, y: snapped.y };
        }

        nextFrames[driver.driver_abbr] = frame;
        nextIndices[driver.driver_abbr] = result.index;

        // 3. Leader Calculation (falling back to alphabetical if everyone is at dist 0)
        const totalDist = (frame.lap - 1) * state.trackLength + frame.dist;
        if (totalDist > maxTotalDist) {
          maxTotalDist = totalDist;
          leaderAbbr = driver.driver_abbr;
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

  startLiveSession: (sessionKey, metadata, provisionedData) => {
    // 1. Process drivers immediately to avoid intermediate empty states
    const drivers = provisionedData?.drivers || [];
    const driverMap: Record<number, string> = {};
    const newDrivers: DriverData[] = drivers.map((d: any) => {
      const abbr = d.name_acronym || d.abbreviation;
      driverMap[d.driver_number] = abbr;
      return {
        driver_abbr: abbr,
        driver_name: d.full_name,
        team: d.team_name,
        team_color: d.team_colour ? `#${d.team_colour}` : '#FFFFFF',
        stints: [],
        lapTimes: {},
        sectorTimes: {},
        personalBests: { s1: Infinity, s2: Infinity, s3: Infinity },
        telemetry: []
      };
    });

    // 2. Initial State
    set({
      isLive: true,
      openF1SessionKey: sessionKey,
      isHistorical: provisionedData?.is_historical || false,
      lastLiveDate: null,
      driverMap,
      trackLayout: provisionedData?.track_layout || [],
      raceData: {
        race_name: provisionedData?.session_name || "LIVE Feed",
        year: new Date().getFullYear(),
        circuit: metadata?.name || provisionedData?.location || "Unknown",
        drivers: newDrivers,
        weather: [],
        track_status: []
      },
      circuitMetadata: {
        id: metadata?.id || `live-${sessionKey}`,
        name: metadata?.name || provisionedData?.session_name || "Unknown Circuit",
        location: metadata?.location || provisionedData?.location || "Unknown Location",
        lapLength: metadata?.lapLength || 5000,
        sectors: metadata?.sectors || { s1_end: 1500, s2_end: 3500 },
        track_path: provisionedData?.track_path || metadata?.track_path
      },
      trackLength: metadata?.lapLength || 5000,
      isPlaying: true, // Auto-play live
      currentTime: 0,
      driverFrames: {},
      lastIndices: {},
      leaderAbbr: null
    });

    console.log('[Store] Live session started:', {
      sessionKey,
      drivers: newDrivers.length,
      trackLayout: provisionedData?.track_layout?.length || 0,
      isPlaying: true
    });
  },

  syncDrivers: (drivers) => {
    set((state) => {
      const driverMap: Record<number, string> = {};
      const newDrivers: DriverData[] = drivers.map(d => {
        const abbr = d.name_acronym || d.abbreviation;
        driverMap[d.driver_number] = abbr;
        return {
          driver_abbr: abbr,
          driver_name: d.full_name,
          team: d.team_name,
          team_color: d.team_colour ? `#${d.team_colour}` : '#FFFFFF',
          stints: [],
          lapTimes: {},
          sectorTimes: {},
          personalBests: { s1: Infinity, s2: Infinity, s3: Infinity },
          telemetry: []
        };
      });

      return {
        driverMap,
        raceData: {
          ...(state.raceData || {
            race_name: "LIVE Feed",
            year: 2024,
            circuit: "Unknown",
            weather: [],
            track_status: []
          }),
          drivers: newDrivers
        }
      };
    });
  },

  appendLiveData: (livePackets) => {
    console.log('[Store] appendLiveData called with:', {
      telemetry: livePackets.telemetry?.length || 0,
      location: livePackets.location?.length || 0,
      weather: livePackets.weather?.length || 0
    });

    set((state) => {
      if (!state.isLive || !state.raceData) {
        console.warn('[Store] appendLiveData ignored - isLive:', state.isLive, 'raceData:', !!state.raceData);
        return state;
      }

      const newRaceData = { ...state.raceData };
      let lastDate = state.lastLiveDate;
      const initialLastDate = lastDate;

      // 1. Process Weather
      if (Array.isArray(livePackets.weather) && livePackets.weather.length > 0) {
        const newWeather = livePackets.weather.map((w: any) => ({
          t: new Date(w.date).getTime(),
          air_temp: w.air_temperature,
          track_temp: w.track_temperature,
          humidity: w.humidity,
          rainfall: w.rainfall,
          wind_speed: w.wind_speed,
          wind_direction: w.wind_direction
        }));
        newRaceData.weather = [...(newRaceData.weather || []), ...newWeather].slice(-100);
      }

      // 2. Process Telemetry & Location
      const telByNum: Record<number, any[]> = {};
      if (Array.isArray(livePackets.telemetry)) {
        livePackets.telemetry.forEach((t: any) => {
          if (!telByNum[t.driver_number]) telByNum[t.driver_number] = [];
          telByNum[t.driver_number].push(t);
          if (!lastDate || t.date > lastDate) lastDate = t.date;
        });
      }

      const locByNum: Record<number, any[]> = {};
      if (Array.isArray(livePackets.location)) {
        livePackets.location.forEach((l: any) => {
          if (!locByNum[l.driver_number]) locByNum[l.driver_number] = [];
          locByNum[l.driver_number].push(l);
          if (!lastDate || l.date > lastDate) lastDate = l.date;
        });
      }

      console.log(`[Store] lastLiveDate updated: ${initialLastDate} -> ${lastDate}`);

      newRaceData.drivers = newRaceData.drivers.map(driver => {
        // Find driver number by abbr
        const dNumEntry = Object.entries(state.driverMap).find(([_, abbr]) => abbr === driver.driver_abbr);
        if (!dNumEntry) return driver;
        const dNum = Number(dNumEntry[0]);

        const driverTel = telByNum[dNum] || [];
        const driverLoc = locByNum[dNum] || [];

        if (driverTel.length === 0 && driverLoc.length === 0) return driver;

        // If we have telemetry, use that as the primary frame source
        // If we ONLY have location, create frames from location
        let newFrames: TelemetryFrame[] = [];

        if (driverTel.length > 0) {
          newFrames = driverTel.map((t: any) => {
            const timestamp = new Date(t.date).getTime();
            const closestLoc = driverLoc.length > 0 ? driverLoc.reduce((prev, curr) =>
              Math.abs(new Date(curr.date).getTime() - timestamp) < Math.abs(new Date(prev.date).getTime() - timestamp) ? curr : prev
            ) : null;

            const rawX = closestLoc?.x || (driver.telemetry.length > 0 ? driver.telemetry[driver.telemetry.length - 1].x : 0);
            const rawY = closestLoc?.y || (driver.telemetry.length > 0 ? driver.telemetry[driver.telemetry.length - 1].y : 0);

            // PATH SNAPPING with Off-track Tolerance
            let x = rawX;
            let y = rawY;
            let distOnLap = 0;
            if (state.trackLayout.length > 0) {
              let minD2 = Infinity;
              let closestP = state.trackLayout[0];
              for (const p of state.trackLayout) {
                const d2 = (rawX - p.x) ** 2 + (rawY - p.y) ** 2;
                if (d2 < minD2) {
                  minD2 = d2;
                  closestP = p;
                }
              }
              // Only snap if within 150 units (approx gravel trap range)
              // This allows retired/crashed cars to sit off-path
              if (minD2 < 150 ** 2) {
                x = closestP.x;
                y = closestP.y;
                distOnLap = closestP.dist;
              } else {
                // If off-track, last known distance is kept
                distOnLap = driver.telemetry.length > 0 ? driver.telemetry[driver.telemetry.length - 1].dist : 0;
              }
            }

            return {
              t: timestamp,
              lap: t.lap_number || (driver.telemetry.length > 0 ? driver.telemetry[driver.telemetry.length - 1].lap : 1),
              dist: distOnLap,
              speed: t.speed,
              rpm: t.rpm,
              gear: t.n_gear,
              throttle: t.throttle,
              brake: t.brake,
              x,
              y,
              compound: "LIVE",
              tyre_age: 0,
              is_pit: false,
              drs: t.drs
            };
          });
        } else if (driverLoc.length > 0) {
          newFrames = driverLoc.map((l: any) => {
            const lastTel = driver.telemetry.length > 0 ? driver.telemetry[driver.telemetry.length - 1] : null;

            let x = l.x;
            let y = l.y;
            let distOnLap = lastTel?.dist || 0;
            if (state.trackLayout.length > 0) {
              let minD2 = Infinity;
              let closestP = state.trackLayout[0];
              for (const p of state.trackLayout) {
                const d2 = (l.x - p.x) ** 2 + (l.y - p.y) ** 2;
                if (d2 < minD2) {
                  minD2 = d2;
                  closestP = p;
                }
              }
              // Snap only if within 150 units
              if (minD2 < 150 ** 2) {
                x = closestP.x;
                y = closestP.y;
                distOnLap = closestP.dist;
              }
            }

            return {
              t: new Date(l.date).getTime(),
              lap: lastTel?.lap || 1,
              dist: distOnLap,
              speed: lastTel?.speed || 0,
              rpm: lastTel?.rpm || 0,
              gear: lastTel?.gear || 0,
              throttle: 0,
              brake: 0,
              x,
              y,
              compound: "LIVE",
              tyre_age: 0,
              is_pit: false,
              drs: 0
            };
          });
        }

        return { ...driver, telemetry: [...driver.telemetry, ...newFrames].slice(-5000) };
      });

      // Ensure lastLiveDate only moves forward
      const finalLastDate = lastDate && (!state.lastLiveDate || lastDate > state.lastLiveDate)
        ? lastDate
        : state.lastLiveDate;

      if (finalLastDate !== initialLastDate) {
        console.log(`[Store] lastLiveDate advanced: ${initialLastDate} -> ${finalLastDate}`);
      }

      return {
        raceData: newRaceData,
        lastLiveDate: finalLastDate
      };
    });
  },

  stopLive: () => set({ isLive: false, openF1SessionKey: null, lastLiveDate: null }),
}));
