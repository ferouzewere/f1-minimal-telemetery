import React from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';
import { StintTimeline } from './StintTimeline';
import { LapHistory } from './LapHistory';

export const TelemetryHUD: React.FC = () => {
    const {
        currentTime,
        raceData,
        focusedDriver
    } = useRaceStore();

    const focusedDriverData = React.useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
    }, [raceData, focusedDriver]);

    const currentFrame = React.useMemo(() => {
        if (!focusedDriverData) return null;
        return getInterpolatedFrame(focusedDriverData.telemetry, currentTime);
    }, [focusedDriverData, currentTime]);

    if (!focusedDriverData) return (
        <div className="telemetry-placeholder">
            <span className="label">SYSTEM IDLE • SELECT DRIVER FOR TELEMETRY</span>
        </div>
    );

    return (
        <div className="telemetry-hud-container">
            <div className="telemetry-bar visible">
                <div className="telemetry-item">
                    <span className="label">FOCUS: {focusedDriverData.driver_abbr}</span>
                    <span className="value gear">{currentFrame?.gear || '-'}</span>
                </div>
                <div className="telemetry-item">
                    <span className="label">THROTTLE</span>
                    <div className="bar-bg">
                        <div className="bar-fill throttle" style={{ width: `${currentFrame?.throttle || 0}%` }}></div>
                    </div>
                </div>
                <div className="telemetry-item">
                    <span className="label">BRAKE</span>
                    <div className="bar-bg">
                        <div className="bar-fill brake" style={{ width: `${currentFrame?.brake || 0}%` }}></div>
                    </div>
                </div>
            </div>
            <StintTimeline />
            <LapHistory />
        </div>
    );
};
