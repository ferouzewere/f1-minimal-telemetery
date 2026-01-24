import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { Arc, Line } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface SpeedometerProps {
    width: number;
    height: number;
}

export const Speedometer: React.FC<SpeedometerProps> = ({ width, height }) => {
    const raceData = useRaceStore((state) => state.raceData);
    const focusedDriver = useRaceStore((state) => state.focusedDriver);
    const currentTime = useRaceStore((state) => state.currentTime);

    const currentFrame = useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
        if (!driver) return null;
        return getInterpolatedFrame(driver.telemetry, currentTime);
    }, [raceData, focusedDriver, currentTime]);

    const speed = currentFrame?.speed || 0;

    const radius = Math.min(width, height) / 2 - 10;
    const innerRadius = radius * 0.85;

    const speedScale = useMemo(() =>
        scaleLinear({
            domain: [0, 360],
            range: [-Math.PI * 0.8, Math.PI * 0.8],
        }), []);

    // Generate tick marks
    const ticks = useMemo(() => {
        const tickData = [];
        for (let i = 0; i <= 360; i += 10) {
            const angle = speedScale(i) - Math.PI / 2;
            const isMajor = i % 40 === 0;
            const length = isMajor ? 12 : 6;
            tickData.push({
                x1: Math.cos(angle) * (radius - 2),
                y1: Math.sin(angle) * (radius - 2),
                x2: Math.cos(angle) * (radius - 2 - length),
                y2: Math.sin(angle) * (radius - 2 - length),
                value: i,
                isMajor
            });
        }
        return tickData;
    }, [radius, speedScale]);

    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
                <filter id="needleGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <Group top={height / 2} left={width / 2}>
                {/* Background Arc */}
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={-Math.PI * 0.8}
                    endAngle={Math.PI * 0.8}
                    fill="#1e293b"
                    opacity={0.3}
                />

                {/* Speed Progress Arc */}
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={-Math.PI * 0.8}
                    endAngle={speedScale(speed)}
                    fill="url(#speedGradient)"
                    cornerRadius={2}
                />

                <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>

                {/* Ticks & Labels */}
                {ticks.map((tick, i) => (
                    <Group key={i}>
                        <Line
                            from={{ x: tick.x1, y: tick.y1 }}
                            to={{ x: tick.x2, y: tick.y2 }}
                            stroke={tick.isMajor ? "#94a3b8" : "#334155"}
                            strokeWidth={tick.isMajor ? 2 : 1}
                        />
                        {tick.isMajor && (
                            <text
                                x={Math.cos(speedScale(tick.value) - Math.PI / 2) * (radius - 25)}
                                y={Math.sin(speedScale(tick.value) - Math.PI / 2) * (radius - 25)}
                                fill="#64748b"
                                fontSize={10}
                                fontWeight={700}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontFamily="JetBrains Mono"
                            >
                                {tick.value}
                            </text>
                        )}
                    </Group>
                ))}

                {/* Speed Needle */}
                <Group transform={`rotate(${(speedScale(speed) * 180) / Math.PI})`}>
                    <path
                        d={`M -2 0 L 0 -${radius - 5} L 2 0 Z`}
                        fill="#3b82f6"
                        style={{ filter: 'url(#needleGlow)' }}
                    />
                    <circle r={4} fill="#020617" stroke="#3b82f6" strokeWidth={2} />
                </Group>

                {/* Center Digital Display */}
                <text
                    y={15}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={radius * 0.45}
                    fontWeight={800}
                    fontFamily="JetBrains Mono"
                >
                    {speed}
                </text>
                <text
                    y={radius * 0.35}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight={700}
                    letterSpacing="0.1em"
                >
                    KM/H
                </text>
            </Group>
        </svg>
    );
};
