import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { curveMonotoneX } from '@visx/curve';
import { useRaceStore } from '../store/useRaceStore';

interface TelemetryPulseProps {
    width: number;
    height: number;
}

export const TelemetryPulse: React.FC<TelemetryPulseProps> = ({ width, height }) => {
    const { raceData, currentTime, focusedDriver } = useRaceStore();

    // Find target driver (focused or session leader)
    const targetDriver = useMemo(() => {
        if (!raceData) return null;
        if (focusedDriver) return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
        return raceData.drivers[0]; // Default to leader
    }, [raceData, focusedDriver]);

    // Slice last 10 seconds of history
    const history = useMemo(() => {
        if (!targetDriver) return [];
        const HISTORY_WINDOW = 10000; // 10s
        return targetDriver.telemetry.filter(f =>
            f.t <= currentTime && f.t >= currentTime - HISTORY_WINDOW
        );
    }, [targetDriver, currentTime]);

    // Scales
    const xScale = useMemo(() => scaleLinear({
        domain: [currentTime - 10000, currentTime],
        range: [0, width],
    }), [currentTime, width]);

    const yScalePercentage = useMemo(() => scaleLinear({
        domain: [0, 100],
        range: [height, 0],
    }), [height]);

    const yScaleSpeed = useMemo(() => scaleLinear({
        domain: [0, 360],
        range: [height, 0],
    }), [height]);

    if (history.length < 2) return null;

    return (
        <div className="telemetry-pulse">
            <div className="pulse-header">
                <span className="pulse-label">PULSE MONITOR • {targetDriver?.driver_abbr}</span>
                <div className="pulse-legend">
                    <span className="legend-item throttle">THROTTLE</span>
                    <span className="legend-item brake">BRAKE</span>
                    <span className="legend-item speed">SPEED</span>
                </div>
            </div>

            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                <Group>
                    {/* Speed Line (Background Glow) */}
                    <LinePath
                        data={history}
                        x={d => xScale(d.t)}
                        y={d => yScaleSpeed(d.speed)}
                        stroke="#3b82f6"
                        strokeWidth={1}
                        strokeOpacity={0.3}
                        curve={curveMonotoneX}
                    />

                    {/* Throttle Line */}
                    <LinePath
                        data={history}
                        x={d => xScale(d.t)}
                        y={d => yScalePercentage(d.throttle)}
                        stroke="#22c55e"
                        strokeWidth={2}
                        curve={curveMonotoneX}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.4))' }}
                    />

                    {/* Brake Line */}
                    <LinePath
                        data={history}
                        x={d => xScale(d.t)}
                        y={d => yScalePercentage(d.brake)}
                        stroke="#ef4444"
                        strokeWidth={2}
                        curve={curveMonotoneX}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' }}
                    />
                </Group>
            </svg>
        </div>
    );
};
