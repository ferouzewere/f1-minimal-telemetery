import React from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';
import { StintTimeline } from './StintTimeline';
import { LapHistory } from './LapHistory';

export const TelemetryHUD: React.FC = () => {
    const {
        currentTime,
        raceData,
        focusedDriver,
        comparisonDriver
    } = useRaceStore();

    const drivers = React.useMemo(() => {
        if (!raceData) return [];
        return [focusedDriver, comparisonDriver]
            .filter(Boolean)
            .map(abbr => raceData.drivers.find(d => d.driver_abbr === abbr))
            .filter(Boolean);
    }, [raceData, focusedDriver, comparisonDriver]);

    if (drivers.length === 0) return (
        <div className="telemetry-placeholder">
            <span className="label">SYSTEM IDLE • SELECT DRIVER FOR TELEMETRY</span>
        </div>
    );

    return (
        <div className="telemetry-hud-container">
            <div className={`telemetry-grid ${drivers.length > 1 ? 'dual' : ''}`}>
                {drivers.map(driver => {
                    const currentFrame = getInterpolatedFrame(driver!.telemetry, currentTime).frame;
                    return (
                        <div key={driver!.driver_abbr} className="telemetry-bar visible">
                            <div className="telemetry-item">
                                <span className="label">DRV: {driver!.driver_abbr}</span>
                                <span className="value gear">{currentFrame?.gear || '-'}</span>
                            </div>
                            <div className="telemetry-item">
                                <span className="label">THR</span>
                                <div className="bar-bg">
                                    <div className="bar-fill throttle" style={{ width: `${currentFrame?.throttle || 0}%` }}></div>
                                </div>
                            </div>
                            <div className="telemetry-item">
                                <span className="label">BRK</span>
                                <div className="bar-bg">
                                    <div className="bar-fill brake" style={{ width: `${currentFrame?.brake || 0}%` }}></div>
                                </div>
                            </div>
                            <div className="telemetry-item">
                                <span className="label">ACC</span>
                                <span className="value">{currentFrame?.ax?.toFixed(1) || '0.0'}G</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {focusedDriver && <StintTimeline />}
            {focusedDriver && <LapHistory />}
        </div>
    );
};
