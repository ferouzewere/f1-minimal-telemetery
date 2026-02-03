import React, { useMemo, useRef } from 'react';
import { Group } from '@visx/group';
import { Arc } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface IntegratedGaugeProps {
    size: number;
}

export const IntegratedGauge: React.FC<IntegratedGaugeProps> = ({ size }) => {
    const raceData = useRaceStore((state) => state.raceData);
    const focusedDriver = useRaceStore((state) => state.focusedDriver);
    const currentTime = useRaceStore((state) => state.currentTime);
    const driverFrames = useRaceStore((state) => state.driverFrames);
    const totalLaps = useRaceStore(state => state.totalLaps);


    const currentFrame = focusedDriver ? driverFrames[focusedDriver] : null;

    // --- DATA EXTRACTION ---
    const speed = currentFrame?.speed || 0;
    const throttle = currentFrame?.throttle || 0;
    const brake = currentFrame?.brake || 0;
    const gear = currentFrame?.gear || 0;
    const rpm = currentFrame?.rpm || 4000;
    const drs = currentFrame?.drs;
    const isPit = currentFrame?.is_pit;

    // Tyre Info
    const compound = currentFrame?.compound || 'UNKNOWN';
    const tyreAge = currentFrame?.tyre_age || 0;
    const getCompoundColor = (c: string) => {
        const up = c.toUpperCase();
        if (up.includes('SOFT')) return '#ef4444';
        if (up.includes('MEDIUM')) return '#facc15';
        if (up.includes('HARD')) return '#f8fafc';
        if (up.includes('INTER')) return '#22c55e';
        if (up.includes('WET')) return '#3b82f6';
        return '#64748b';
    };
    const compoundColor = getCompoundColor(compound);

    // Fuel Estimate
    const currentLap = currentFrame?.lap || 1;
    const progress = totalLaps > 0 ? (currentLap / totalLaps) : 0;
    const fuelPercentage = Math.max(0, 100 * (1 - progress));



    // --- COMPASS LOGIC ---
    const lastBearingRef = useRef(0);
    const bearing = useMemo(() => {
        let target = 0;
        if (raceData && focusedDriver) {
            const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
            if (driver) {
                // Short look-ahead for heading
                const f1 = getInterpolatedFrame(driver.telemetry, currentTime).frame;
                const f2 = getInterpolatedFrame(driver.telemetry, currentTime + 0.1).frame;
                const dx = f2.x - f1.x;
                const dy = f2.y - f1.y;
                target = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
            }
        }

        // Moving average / shortest path rotation
        const current = lastBearingRef.current;
        let delta = target - (current % 360 + 360) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        lastBearingRef.current += delta;
        return lastBearingRef.current;
    }, [raceData, focusedDriver, currentTime]);

    // --- DIMENSIONS & SCALES ---
    // --- PROPORTIONAL SCALING SYSTEM ---
    const baseSize = 320;
    const s = size / baseSize; // Universal scale multiplier

    // --- DIMENSIONS & SCALES ---
    const radius = size / 2;
    const outerBezel = radius - (2 * s);
    const speedDialRadius = radius * 0.75;
    const innerDialRadius = speedDialRadius * 0.85;

    const speedScale = useMemo(() => scaleLinear({
        domain: [0, 360],
        range: [-Math.PI * 0.75, Math.PI * 0.75],
    }), []);

    const rpmScale = useMemo(() => scaleLinear({
        domain: [0, 12500],
        range: [-Math.PI * 0.75, Math.PI * 0.75]
    }), []);

    // Viz normalized values
    const vizThrottle = throttle > 1 ? Math.max(throttle, 5) : throttle;
    const normBrake = brake <= 1 ? brake * 100 : brake;
    const vizBrake = normBrake > 1 ? Math.max(normBrake, 5) : normBrake;

    return (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
            <defs>
                <filter id="intGlow">
                    <feGaussianBlur stdDeviation={2 * s} result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="intSpeedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
            </defs>

            <Group top={radius} left={radius}>

                {/* 1. OUTER COMPASS RING (Scaled) */}
                <Group
                    transform={`rotate(${-bearing})`}
                    style={{ transition: 'transform 0.1s linear' }}
                >
                    <Arc
                        innerRadius={speedDialRadius + (8 * s)}
                        outerRadius={outerBezel}
                        startAngle={0}
                        endAngle={Math.PI * 2}
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth={1 * s}
                        strokeDasharray={`${2 * s},${4 * s}`}
                    />
                    <text y={-(speedDialRadius + (12 * s))} textAnchor="middle" fill="#ef4444" fontSize={12 * s} fontWeight={900}>N</text>
                    <text y={(speedDialRadius + (20 * s))} textAnchor="middle" fill="#64748b" fontSize={10 * s} fontWeight={700}>S</text>
                    <text x={(speedDialRadius + (20 * s))} y={4 * s} textAnchor="middle" fill="#64748b" fontSize={10 * s} fontWeight={700}>E</text>
                    <text x={-(speedDialRadius + (20 * s))} y={4 * s} textAnchor="middle" fill="#64748b" fontSize={10 * s} fontWeight={700}>W</text>
                </Group>

                {/* Heading indicator */}
                <path d={`M ${-4 * s} -${outerBezel + (4 * s)} L ${4 * s} -${outerBezel + (4 * s)} L 0 -${outerBezel - (2 * s)} Z`} fill="#3b82f6" />

                {/* 2. MAIN DIAL (Proportional) */}
                <circle r={speedDialRadius} fill="rgba(59, 130, 246, 0.05)" />
                <Arc
                    innerRadius={innerDialRadius}
                    outerRadius={speedDialRadius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={Math.PI * 0.75}
                    fill="rgba(15, 23, 42, 0.6)"
                    stroke="#1e293b"
                    strokeWidth={0.5 * s}
                />
                <Arc
                    innerRadius={innerDialRadius}
                    outerRadius={speedDialRadius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={speedScale(speed)}
                    fill="url(#intSpeedGrad)"
                    cornerRadius={2 * s}
                />

                {/* 2.5 SHIFT LIGHTS */}
                <Group top={-speedDialRadius - (12 * s)}>
                    {Array.from({ length: 9 }).map((_, i) => {
                        const threshold = 10000 + (i * 250);
                        const isActive = rpm >= threshold;
                        let color = '#22c55e';
                        if (i >= 3) color = '#ef4444';
                        if (i >= 6) color = '#a855f7';
                        return (
                            <rect
                                key={i}
                                x={(-32 * s) + i * (7.5 * s)}
                                y={0}
                                width={5 * s}
                                height={3 * s}
                                rx={1 * s}
                                fill={isActive ? color : 'rgba(30, 41, 59, 0.5)'}
                                style={{ filter: isActive ? `drop-shadow(0 0 ${4 * s}px ${color})` : 'none' }}
                            />
                        );
                    })}
                </Group>

                {/* RPM Inner Line */}
                <Arc
                    innerRadius={innerDialRadius - (6 * s)}
                    outerRadius={innerDialRadius - (4 * s)}
                    startAngle={-Math.PI * 0.75}
                    endAngle={rpmScale(rpm)}
                    fill={rpm > 11500 ? "#a855f7" : rpm > 10500 ? "#ef4444" : "#22c55e"}
                    opacity={0.6}
                    cornerRadius={1 * s}
                />

                {/* 3. CENTER HUD ASSETS (Scaling Positions) */}

                {/* Speed Digits */}
                <Group top={-45 * s}>
                    <text
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={34 * s}
                        fontWeight={900}
                        fontFamily="Outfit"
                        style={{ letterSpacing: '-0.02em', filter: `drop-shadow(0 0 ${12 * s}px rgba(59,130,246,0.3))` }}
                    >
                        {Math.round(speed)}
                    </text>
                    <text y={12 * s} textAnchor="middle" fill="#64748b" fontSize={8 * s} fontWeight={800} letterSpacing="0.2em">KM/H</text>
                </Group>

                {/* Status Row */}
                <Group top={8 * s}>
                    <Group left={-60 * s}>
                        <rect x={-8 * s} y={-11 * s} width={16 * s} height={22 * s} rx={1 * s}
                            fill={drs === 1 ? "rgba(34, 197, 94, 0.2)" : "transparent"}
                            stroke={drs === 1 ? "#22c55e" : "#475569"}
                            strokeWidth={1 * s}
                        />
                        {drs === 1 && <rect x={-6 * s} y={-9 * s} width={12 * s} height={18 * s} rx={0.5 * s} fill="#22c55e" opacity={0.6} />}
                        <text y={20 * s} textAnchor="middle" fill={drs === 1 ? "#22c55e" : "#64748b"} fontSize={6 * s} fontWeight={800}>DRS</text>
                    </Group>

                    <Group>
                        <circle r={11 * s} fill="rgba(15, 23, 42, 0.4)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5 * s} />
                        <circle
                            cx={Math.max(-8 * s, Math.min(8 * s, (currentFrame?.ay || 0) * (2.5 * s)))}
                            cy={Math.max(-8 * s, Math.min(8 * s, (currentFrame?.ax || 0) * (-2.5 * s)))}
                            r={2.5 * s}
                            fill={Math.abs(currentFrame?.ax || 0) > 2 ? "#ef4444" : "#fff"}
                        />
                        <text y={20 * s} textAnchor="middle" fill="#64748b" fontSize={6 * s} fontWeight={800}>GYRO</text>
                    </Group>

                    <Group left={60 * s}>
                        <rect x={-8 * s} y={-11 * s} width={16 * s} height={22 * s} rx={1 * s} fill="transparent" stroke="#475569" strokeWidth={1 * s} />
                        <rect x={-3 * s} y={-13 * s} width={6 * s} height={2 * s} fill="#475569" />
                        <rect
                            x={-8 * s}
                            y={(-11 * s) + (22 * s * (1 - fuelPercentage / 100))}
                            width={16 * s}
                            height={(22 * s) * (fuelPercentage / 100)}
                            fill={fuelPercentage < 15 ? "#ef4444" : "#3b82f6"}
                            rx={0.5 * s}
                        />
                        <text y={20 * s} textAnchor="middle" fill="#64748b" fontSize={6 * s} fontWeight={800}>FUEL</text>
                    </Group>
                </Group>

                {/* Gear Indicators */}
                <Group top={44 * s}>
                    {Array.from({ length: 9 }).map((_, i) => {
                        const isN = i === 0;
                        const active = (isN && gear === 0) || (gear === i);
                        const leftPos = (-44 * s) + (i * (11 * s));
                        let color = active ? (isN && isPit ? "#facc15" : "#22c55e") : "rgba(255, 255, 255, 0.05)";
                        return (
                            <Group key={i} left={leftPos}>
                                <rect x={-2.5 * s} y={0} width={5 * s} height={12 * s} rx={1 * s}
                                    fill={color}
                                    style={{ filter: active ? `drop-shadow(0 0 ${4 * s}px ${color})` : 'none' }}
                                />
                                <text y={20 * s} textAnchor="middle" fill={active ? "#fff" : "#475569"} fontSize={7 * s} fontWeight={800}>{isN ? 'N' : i}</text>
                            </Group>
                        );
                    })}
                </Group>

                {/* Arches */}
                <Group>
                    <Arc
                        innerRadius={innerDialRadius - (12 * s)}
                        outerRadius={innerDialRadius - (8 * s)}
                        startAngle={Math.PI * 0.75}
                        endAngle={Math.PI * 0.75 + (Math.PI * 0.45 * (vizThrottle / 100))}
                        fill="#22c55e"
                        cornerRadius={2 * s}
                    />
                    <Arc
                        innerRadius={innerDialRadius - (12 * s)}
                        outerRadius={innerDialRadius - (8 * s)}
                        startAngle={-Math.PI * 0.75}
                        endAngle={-Math.PI * 0.75 - (Math.PI * 0.45 * (vizBrake / 100))}
                        fill="#ef4444"
                        cornerRadius={2 * s}
                    />
                </Group>

                {/* Metadata */}
                <Group top={68 * s}>
                    <text textAnchor="middle" fill={compoundColor} fontSize={7 * s} fontWeight={900} letterSpacing="0.1em">
                        {compound.toUpperCase()} • {tyreAge} LAPS
                    </text>
                </Group>

            </Group>
        </svg>
    );
};
