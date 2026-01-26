// raceWorker.ts
export { };

/**
 * Optimized Telemetry Worker
 * Moves heavy data processing off the main thread.
 */

self.onmessage = (e: MessageEvent) => {
    const { data, metadata } = e.data;

    if (!data || !data.drivers || data.drivers.length === 0) {
        self.postMessage({ error: 'Invalid data' });
        return;
    }

    // 1. REPAIR TELEMETRY: Handle non-monotonic timestamps
    data.drivers.forEach((driver: any) => {
        let offset = 0;
        let lastRawT = -1;

        driver.telemetry.forEach((frame: any) => {
            if (lastRawT !== -1 && frame.t < lastRawT - 10000) {
                offset += lastRawT + 1000;
            }
            lastRawT = frame.t;
            frame.t += offset;
        });
    });

    // 2. Constants
    const lapLength = metadata?.lapLength || 3337;
    const s1EndDist = metadata?.sectors.s1_end || 0;
    const s2EndDist = metadata?.sectors.s2_end || 0;

    // 3. Single-Pass Processing
    let maxLap = 0;
    let maxT = 0;
    let sessionBest = Infinity;
    const sessionSectorBest = { s1: Infinity, s2: Infinity, s3: Infinity };
    const pitStops: any[] = [];

    data.drivers.forEach((driver: any) => {
        const driverLapTimes: Record<number, number> = {};
        const driverSectorTimes: Record<number, { s1: number; s2: number; s3: number }> = {};
        const personalBests = { s1: Infinity, s2: Infinity, s3: Infinity };

        let lapStartTime = -1;
        let s1EndTime = -1;
        let s2EndTime = -1;
        let currentLapNum = -1;
        let inPit = false;

        driver.telemetry.forEach((frame: any) => {
            if (frame.lap > maxLap) maxLap = frame.lap;
            if (frame.t > maxT) maxT = frame.t;

            // Pit Stop Detection
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

            // Lap/Sector Logic
            if (frame.lap !== currentLapNum) {
                if (currentLapNum !== -1 && lapStartTime !== -1) {
                    const lapDuration = frame.t - lapStartTime;
                    driverLapTimes[currentLapNum] = lapDuration;
                    if (lapDuration < sessionBest) sessionBest = lapDuration;

                    // S3 calculation for previous lap
                    const s3Time = frame.t - (s2EndTime !== -1 ? s2EndTime : lapStartTime);
                    if (driverSectorTimes[currentLapNum]) {
                        driverSectorTimes[currentLapNum].s3 = s3Time;
                        if (s3Time < personalBests.s3) personalBests.s3 = s3Time;
                        if (s3Time < sessionSectorBest.s3) sessionSectorBest.s3 = s3Time;
                    }
                }
                currentLapNum = frame.lap;
                lapStartTime = frame.t;
                s1EndTime = -1;
                s2EndTime = -1;
            }

            // Sector Crossings
            if (s1EndTime === -1 && frame.dist >= s1EndDist) {
                s1EndTime = frame.t;
                const s1Time = s1EndTime - lapStartTime;
                if (!driverSectorTimes[currentLapNum]) driverSectorTimes[currentLapNum] = { s1: 0, s2: 0, s3: 0 };
                driverSectorTimes[currentLapNum].s1 = s1Time;
                if (s1Time < personalBests.s1) personalBests.s1 = s1Time;
                if (s1Time < sessionSectorBest.s1) sessionSectorBest.s1 = s1Time;
            } else if (s2EndTime === -1 && frame.dist >= s2EndDist) {
                s2EndTime = frame.t;
                const s2Time = s2EndTime - (s1EndTime !== -1 ? s1EndTime : lapStartTime);
                if (!driverSectorTimes[currentLapNum]) driverSectorTimes[currentLapNum] = { s1: 0, s2: 0, s3: 0 };
                driverSectorTimes[currentLapNum].s2 = s2Time;
                if (s2Time < personalBests.s2) personalBests.s2 = s2Time;
                if (s2Time < sessionSectorBest.s2) sessionSectorBest.s2 = s2Time;
            }
        });

        driver.lapTimes = driverLapTimes;
        driver.sectorTimes = driverSectorTimes;
        driver.personalBests = personalBests;
    });

    // Calculate track length based on first driver's lap 1
    const firstDriver = data.drivers[0];
    const lapLengths = firstDriver.telemetry
        .filter((f: any) => f.lap === 1)
        .map((f: any) => f.dist);
    const calculatedLength = metadata?.lapLength || Math.max(...lapLengths) || lapLength;

    self.postMessage({
        raceData: data,
        calculatedLength,
        sessionSectorBest,
        maxLap,
        pitStops,
        sessionBest
    });
};
