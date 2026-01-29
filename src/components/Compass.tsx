import React, { useMemo, useRef } from 'react';
import { Group } from '@visx/group';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface CompassProps {
    size: number;
}

export const Compass: React.FC<CompassProps> = ({ size }) => {
    const raceData = useRaceStore(state => state.raceData);
    const currentTime = useRaceStore(state => state.currentTime);
    const focusedDriver = useRaceStore(state => state.focusedDriver);

    // Keep track of cumulative rotation to avoid 360->0 jumps
    const lastBearingRef = useRef(0);

    const compassContent = useMemo(() => {
        // Calculate current bearing/heading
        let targetBearing = 0; // Default North
        let bearingSource = 'TRACK';

        if (raceData && focusedDriver) {
            // Get focused driver's current and next position to calculate heading
            const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
            if (driver && driver.telemetry && driver.telemetry.length > 0) {
                const currentResult = getInterpolatedFrame(driver.telemetry, currentTime);
                const nextResult = getInterpolatedFrame(driver.telemetry, currentTime + 0.1);

                if (currentResult.frame && nextResult.frame) {
                    const dx = nextResult.frame.x - currentResult.frame.x;
                    const dy = nextResult.frame.y - currentResult.frame.y;

                    // Calculate bearing (0° = North, 90° = East)
                    targetBearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
                    bearingSource = focusedDriver;
                }
            }
        }

        // Calculate shortest rotation path to target
        const current = lastBearingRef.current;
        const normalizedCurrent = (current % 360 + 360) % 360;
        let delta = targetBearing - normalizedCurrent;

        // Take the shortest path
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        lastBearingRef.current += delta;
        const smoothedBearing = lastBearingRef.current;
        const displayBearing = (Math.round(targetBearing) % 360 + 360) % 360;

        // Radius for the compass group
        const r = size / 2;

        return (
            <Group top={r} left={r}>
                <circle r={r} fill="transparent" stroke="#0ea5e9" strokeWidth={1} strokeOpacity={0.3} />
                <circle r={r * 0.8} fill="none" stroke="#64748b" strokeWidth={0.5} strokeOpacity={0.2} strokeDasharray="2,2" />

                {/* Rotating compass rose with smooth transition */}
                <Group
                    style={{
                        transform: `rotate(${-smoothedBearing}deg)`,
                        transformOrigin: '0px 0px', // Rotating around its own center
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    {/* North Indicator (Red) */}
                    <path d={`M 0 -${r * 0.7} L 4 0 L -4 0 Z`} fill="#ef4444" opacity={0.9} />
                    <text y={-r - 5} textAnchor="middle" fontSize={10} fill="#ffffff" fontWeight={800} style={{ fontFamily: 'JetBrains Mono' }}>N</text>

                    {/* South Indicator (White) */}
                    <path d={`M 0 ${r * 0.7} L 4 0 L -4 0 Z`} fill="#ffffff" opacity={0.4} />

                    {/* Tactical markers */}
                    {Array.from({ length: 8 }).map((_, i) => (
                        <line
                            key={i}
                            y1={-r * 0.85} y2={-r * 0.7}
                            transform={`rotate(${i * 45})`}
                            stroke="#0ea5e9" strokeWidth={1} strokeOpacity={0.5}
                        />
                    ))}
                </Group>

                {/* Bearing display (fixed orientation) */}
                <text y={r + 15} textAnchor="middle" fontSize={9} fill="#0ea5e9" fontWeight={700} style={{ fontFamily: 'JetBrains Mono' }}>
                    {displayBearing.toString().padStart(3, '0')}°
                </text>
                <text y={r + 25} textAnchor="middle" fontSize={7} fill="#64748b" fontWeight={600} style={{ fontFamily: 'JetBrains Mono' }}>
                    {bearingSource}
                </text>
            </Group>
        );
    }, [size, raceData, focusedDriver, currentTime]);

    return (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
            {compassContent}
        </svg>
    );
};
