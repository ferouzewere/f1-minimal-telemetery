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
    const throttle = currentFrame?.throttle || 0;
    const brake = currentFrame?.brake || 0;
    const gear = currentFrame?.gear || 0; // Assuming 0=N, 1-8=Gears

    // Gear Mapping
    const GEARS = ['R', 'N', '1', '2', '3', '4', '5', '6', '7', '8'];
    // Map telemetry gear val to index. 0 -> 'N' (index 1). 1 -> '1' (index 2).
    // If gear is negative or whatever, fallback to N or R logic.
    // For now assuming gear is int.
    const currentGearIndex = GEARS.indexOf(String(gear)) !== -1 ? GEARS.indexOf(String(gear)) : (gear === 0 ? 1 : 1);

    const radius = Math.min(width, height) / 2 - 10;
    const innerRadius = radius * 0.85;
    // Thicker telemetry ring
    const telemetryThickness = 15;
    const telemetryOuter = radius * 0.70;
    const telemetryInner = telemetryOuter - telemetryThickness;

    const speedScale = useMemo(() =>
        scaleLinear({
            domain: [0, 360],
            // Symmetrical scale: -135deg (Bottom Left) to +135deg (Bottom Right)
            // 0 is Top (12 o'clock)
            range: [-Math.PI * 0.75, Math.PI * 0.75],
        }), []);

    // Generate tick marks
    const ticks = useMemo(() => {
        const tickData = [];
        for (let i = 0; i <= 360; i += 20) {
            // Actually, let's use the rotation group approach for ticks to match scale exactly?
            // Or just manual trig.
            // If scale 0 is -0.75PI (Bottom Left, -135deg). 
            // In standard trig, -135deg is Bottom Left? No.
            // Standard Trig: 0 is Right. -90 is Top. -135 is Top Left.
            // VisX Arc: 0 is Top (12 o'clock). Clockwise positive.
            // So -0.75PI is -135deg (Bottom Left of circle, going CCW from Top).
            // +0.75PI is +135deg (Bottom Right of circle).

            // For x/y calculation:
            // Angle relative to "Right" (Standard Math):
            // VisX 0 (Top) is -90deg (Math).
            // So MathAngle = VisXAngle - PI/2.
            const visXAngle = speedScale(i);
            const mathAngle = visXAngle - Math.PI / 2;

            const isMajor = i % 40 === 0;
            const length = isMajor ? 8 : 4;
            tickData.push({
                x1: Math.cos(mathAngle) * (radius - 2),
                y1: Math.sin(mathAngle) * (radius - 2),
                x2: Math.cos(mathAngle) * (radius - 2 - length),
                y2: Math.sin(mathAngle) * (radius - 2 - length),
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
                {/* Mask for Gear Carousel - Luminance mask needs WHITE to be visible */}
                <linearGradient id="carouselMask" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="white" stopOpacity="0" />
                    <stop offset="25%" stopColor="white" stopOpacity="1" />
                    <stop offset="75%" stopColor="white" stopOpacity="1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>

                {/* Vertical Gradients */}
                <linearGradient id="throttleGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="brakeGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                </linearGradient>
            </defs>

            <Group top={height / 2} left={width / 2}>
                {/* --- SPEEDOMETER OUTER RING --- */}

                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={Math.PI * 0.75}
                    fill="#1e293b"
                    opacity={0.3}
                    cornerRadius={4}
                />

                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={speedScale(speed)}
                    fill="url(#speedGradient)"
                    cornerRadius={4}
                />

                <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>

                {/* Ticks */}
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
                                x={Math.cos(speedScale(tick.value) - Math.PI / 2) * (radius - 20)}
                                y={Math.sin(speedScale(tick.value) - Math.PI / 2) * (radius - 20)}
                                fill="#64748b"
                                fontSize={8}
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

                {/* --- GEAR CAROUSEL (Upper Center) --- */}
                {/* Placed in the upper half, just above center */}
                <Group top={-50}>
                    <svg x={-60} y={-30} width={120} height={60} style={{ overflow: 'visible' }}>
                        <mask id="gearMask">
                            <rect x={0} y={0} width={120} height={60} fill="url(#carouselMask)" />
                        </mask>
                        <g mask="url(#gearMask)">
                            {GEARS.map((g, i) => {
                                const offset = (i - currentGearIndex) * 25; // Tighter spacing
                                const isActive = i === currentGearIndex;
                                const dist = Math.abs(i - currentGearIndex);

                                return (
                                    <text
                                        key={g}
                                        x={60 + offset}
                                        y={45}
                                        textAnchor="middle"
                                        fill={isActive ? "#e2e8f0" : "#64748b"} // Muted active color (Slate 200)
                                        fontSize={isActive ? 32 : 14}
                                        fontWeight={isActive ? 900 : 700}
                                        fontFamily="Outfit"
                                        style={{
                                            opacity: isActive ? 1 : Math.max(0, 0.4 - dist * 0.2),
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            filter: isActive ? 'drop-shadow(0 0 8px rgba(226, 232, 240, 0.3))' : 'none' // Reduced glow
                                        }}
                                    >
                                        {g}
                                    </text>
                                )
                            })}
                        </g>
                    </svg>
                </Group>

                {/* --- TELEMETRY ARCS (Split Top) --- */}

                {/* LEFT SIDE: THROTTLE (Green) */}
                {/* Range: -0.75PI (Bottom Left) -> 0 (Top Center) */}
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={-Math.PI * 0.75}
                    endAngle={0}
                    fill="#1e293b" opacity={0.3}
                    cornerRadius={4}
                />
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={-Math.PI * 0.75}
                    // Fill UP from bottom (-0.75 PI) towards 0
                    endAngle={-Math.PI * 0.75 + (Math.PI * 0.75 * (throttle / 100))}
                    fill="url(#throttleGrad)"
                    cornerRadius={4}
                />
                <text x={-telemetryInner + 5} y={-10} fill="#22c55e" fontSize={9} fontWeight={800} fontFamily="Inter" textAnchor="end">THR</text>

                {/* RIGHT SIDE: BRAKE (Red) */}
                {/* Range: 0.75PI (Bottom Right) -> 0 (Top Center) */}
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={Math.PI * 0.75}
                    endAngle={0}
                    fill="#1e293b" opacity={0.3}
                    cornerRadius={4}
                />
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={Math.PI * 0.75}
                    // Fill UP from bottom (0.75 PI) towards 0 (Decrease angle)
                    endAngle={Math.PI * 0.75 - (Math.PI * 0.75 * (brake / 100))}
                    fill="url(#brakeGrad)"
                    cornerRadius={4}
                />
                <text x={telemetryInner - 5} y={-10} fill="#ef4444" fontSize={9} fontWeight={800} fontFamily="Inter" textAnchor="start">BRK</text>


                {/* Speed Needle */}
                <Group transform={`rotate(${(speedScale(speed) * 180) / Math.PI})`}>
                    <path
                        d={`M -3 0 L 0 -${radius - 2} L 3 0 Z`}
                        fill="#3b82f6"
                        style={{ filter: 'url(#needleGlow)' }}
                    />
                    <circle r={5} fill="#0f172a" stroke="#3b82f6" strokeWidth={2} />
                </Group>

                {/* Speed in Bottom Gap */}
                <text
                    y={radius * 0.8} // Lower down in the gap
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={48}
                    fontWeight={900}
                    fontFamily="Outfit"
                    style={{ filter: 'drop-shadow(0 2px 10px rgba(59, 130, 246, 0.4))' }}
                >
                    {Math.round(speed)}
                </text>
                <text
                    y={radius * 0.8 + 14}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={10}
                    fontWeight={800}
                    letterSpacing="0.2em"
                >
                    KM/H
                </text>
            </Group>
        </svg>
    );
};
