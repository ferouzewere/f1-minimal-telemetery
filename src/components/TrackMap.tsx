import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveCardinal } from '@visx/curve';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface TrackMapProps {
    width: number;
    height: number;
}

const TEAM_COLORS: Record<string, string> = {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E80020',
    'Mercedes': '#27F4D2',
    'McLaren': '#FF8000',
    'Aston Martin': '#229971',
    'Alpine': '#0093CC',
    'Williams': '#64C4FF',
    'RB': '#6692FF',
    'Kick Sauber': '#52E252',
    'Haas F1 Team': '#B6BABD',
};

const DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#a855f7'];

export const TrackMap: React.FC<TrackMapProps> = ({ width, height }) => {
    const raceData = useRaceStore((state) => state.raceData);
    const currentTime = useRaceStore((state) => state.currentTime);
    const focusedDriver = useRaceStore((state) => state.focusedDriver);

    // Use first driver's path as the track outline
    const trackPoints = useMemo(() => {
        if (!raceData || !raceData.drivers[0]) return [];
        return raceData.drivers[0].telemetry.map(f => ({ x: f.x, y: f.y }));
    }, [raceData]);

    const driverPositions = useMemo(() => {
        if (!raceData) return [];
        return raceData.drivers.map((driver, idx) => {
            const frame = getInterpolatedFrame(driver.telemetry, currentTime);

            return {
                abbr: driver.driver_abbr,
                x: frame.x,
                y: frame.y,
                isPit: frame.is_pit,
                color: TEAM_COLORS[driver.team] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
            };
        });
    }, [raceData, currentTime]);

    if (!raceData || trackPoints.length === 0) return null;

    return (
        <svg width={width} height={height} viewBox="0 0 1000 700">
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <Group>
                {/* Track Outline */}
                <LinePath
                    data={trackPoints}
                    x={(d: any) => d.x}
                    y={(d: any) => d.y}
                    stroke="#1e293b"
                    strokeWidth={16}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    curve={curveCardinal}
                />
                <LinePath
                    data={trackPoints}
                    x={(d: any) => d.x}
                    y={(d: any) => d.y}
                    stroke="#0f172a"
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    curve={curveCardinal}
                />

                {/* Start/Finish Line */}
                <rect
                    x={trackPoints[0].x - 2}
                    y={trackPoints[0].y - 12}
                    width={4}
                    height={24}
                    fill="#f8fafc"
                    opacity={0.3}
                />

                {/* Car Indicators */}
                {driverPositions.map((pos) => {
                    const isFocused = focusedDriver === pos.abbr;
                    return (
                        <Group
                            key={pos.abbr}
                            top={pos.y}
                            left={pos.x}
                            style={{ zIndex: isFocused ? 100 : 1 }}
                        >
                            {/* Pit indicator */}
                            {pos.isPit && (
                                <circle r={15} fill="none" stroke="#facc15" strokeWidth={1} strokeDasharray="2,2">
                                    <animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                            )}

                            <circle
                                r={isFocused ? 10 : 5}
                                fill={pos.color}
                                stroke={isFocused ? "#ffffff" : "none"}
                                strokeWidth={isFocused ? 2 : 0}
                                style={{
                                    filter: isFocused ? 'url(#glow)' : 'none',
                                    opacity: isFocused ? 1 : 0.6,
                                    transition: 'all 0.1s ease-out'
                                }}
                            />

                            {isFocused && (
                                <text
                                    y={-18}
                                    textAnchor="middle"
                                    fill="#ffffff"
                                    fontSize={12}
                                    fontWeight={800}
                                    style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    {pos.abbr}
                                </text>
                            )}
                        </Group>
                    );
                })}
            </Group>
        </svg>
    );
};
