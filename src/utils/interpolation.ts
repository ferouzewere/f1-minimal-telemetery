import type { TelemetryFrame } from '../store/useRaceStore';

/**
 * Linear interpolation between two numbers
 */
export const lerp = (v0: number, v1: number, t: number): number => {
    return v0 * (1 - t) + v1 * t;
};

/**
 * Interpolates between two telemetry frames based on current time
 */
export const interpolateFrames = (
    f0: TelemetryFrame,
    f1: TelemetryFrame,
    currentTime: number
): TelemetryFrame => {
    if (currentTime <= f0.t) return f0;
    if (currentTime >= f1.t) return f1;

    const t = (currentTime - f0.t) / (f1.t - f0.t);

    return {
        t: currentTime,
        lap: f0.lap, // Lap doesn't interpolate
        dist: lerp(f0.dist, f1.dist, t),
        speed: Math.round(lerp(f0.speed, f1.speed, t)),
        gear: t < 0.5 ? f0.gear : f1.gear, // Discontinuous values use nearest
        throttle: Math.round(lerp(f0.throttle, f1.throttle, t)),
        brake: Math.round(lerp(f0.brake, f1.brake, t)),
        x: lerp(f0.x, f1.x, t),
        y: lerp(f0.y, f1.y, t),
        compound: f0.compound, // String doesn't interpolate
        tyre_age: f0.tyre_age, // Integer discrete doesn't interpolate smoothly in life
        is_pit: f0.is_pit || f1.is_pit, // Show pit if either is true to avoid flicker
        drs: t < 0.5 ? f0.drs : f1.drs
    };
};

/**
 * Efficiently finds the bounding frames for a given time and returns interpolated frame
 */
export const getInterpolatedFrame = (
    telemetry: TelemetryFrame[],
    currentTime: number
): TelemetryFrame => {
    if (telemetry.length === 0) throw new Error("Empty telemetry");
    if (telemetry.length === 1) return telemetry[0];

    // Binary search for the index where frames[i].t <= currentTime < frames[i+1].t
    let low = 0;
    let high = telemetry.length - 2;
    let index = 0;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (telemetry[mid].t <= currentTime) {
            index = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return interpolateFrames(telemetry[index], telemetry[index + 1], currentTime);
};
