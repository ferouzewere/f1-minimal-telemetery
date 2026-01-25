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

    // Minimum visual thresholds for visibility
    const vizThrottle = throttle > 1 ? Math.max(throttle, 5) : throttle;
    // Handle brake data that might be 0-1 (boolean/normalized) vs 0-100
    // If brake is <= 1, assume it's normalized and scale to 100
    const normalizedBrake = brake <= 1 ? brake * 100 : brake;
    const vizBrake = normalizedBrake > 1 ? Math.max(normalizedBrake, 5) : normalizedBrake;

    // Gear Mapping
    const GEARS = ['R', 'N', '1', '2', '3', '4', '5', '6', '7', '8'];
    const currentGearIndex = GEARS.indexOf(String(gear)) !== -1 ? GEARS.indexOf(String(gear)) : (gear === 0 ? 1 : 1);

    // --- RPM SIMULATION LOGIC ---
    // Theoretical Max Speeds per Gear (Approximate 2024 F1 Specs)
    const MAX_SPEEDS = [
        360, // R (Ignored mostly)
        360, // N
        130, // 1st
        170, // 2nd
        210, // 3rd
        250, // 4th
        290, // 5th
        325, // 6th
        360, // 7th
        395  // 8th
    ];
    const MAX_RPM = 12500;
    const IDLE_RPM = 4000;

    // Calculate RPM
    let rpm = IDLE_RPM;
    if (gear > 0) { // Moving in Gear
        const gearMaxSpeed = MAX_SPEEDS[gear + 1] || 360;

        // Simple linear map for now: 0 -> MaxSpeed maps to 0 -> MaxRPM? No.
        // RPM = (Speed / MaxGearSpeed) * PeakRPM.
        // But we need to account for power band.
        // Let's simplified linear ratio:
        rpm = (speed / gearMaxSpeed) * MAX_RPM;
        // Clamp to min/max
        rpm = Math.max(IDLE_RPM, Math.min(MAX_RPM, rpm));

        // Add "Noise" or variation based on throttle if clutch is engaged? 
        // No, in gear, RPM is locked to wheel speed.
    } else { // Neutral or Reverse
        // Rev based on throttle input
        rpm = IDLE_RPM + ((throttle / 100) * (MAX_RPM - IDLE_RPM));
    }

    // RPM Color Logic
    // 0-10k: Green
    // 10k-11.5k: Red
    // 11.5k-12.5k: Blue/Purple (Shift)

    // Rev Lights (LED Array)
    const REV_LEDS = 15;
    const ledData = useMemo(() => {
        const leds = [];
        for (let i = 0; i < REV_LEDS; i++) {
            const threshold = IDLE_RPM + ((MAX_RPM - IDLE_RPM) / REV_LEDS) * i;
            const isOn = rpm >= threshold;

            // Color Bands
            let color = '#22c55e'; // Green
            if (i >= 5) color = '#ef4444'; // Red
            if (i >= 10) color = '#3b82f6'; // Blue
            if (i >= 13) color = '#a855f7'; // Purple

            leds.push({ id: i, isOn, color });
        }
        return leds;
    }, [rpm]);


    const radius = Math.min(width, height) / 2 - 25;
    const innerRadius = radius * 0.85;
    // Thicker telemetry ring
    // Thicker telemetry ring
    const telemetryThickness = 15;
    const telemetryOuter = radius * 0.70;
    const telemetryInner = telemetryOuter - telemetryThickness;

    // RPM Gauge Radius (Inside speed)
    const rpmRadius = innerRadius - 15;
    const rpmInner = rpmRadius - 2;

    const speedScale = useMemo(() =>
        scaleLinear({
            domain: [0, 360],
            // Symmetrical scale: -135deg (Bottom Left) to +135deg (Bottom Right)
            // 0 is Top (12 o'clock)
            range: [-Math.PI * 0.75, Math.PI * 0.75],
        }), []);

    const rpmScale = useMemo(() =>
        scaleLinear({
            domain: [0, MAX_RPM],
            range: [-Math.PI * 0.75, Math.PI * 0.75]
        }), []);

    // Generate tick marks
    const ticks = useMemo(() => {
        const tickData = [];
        for (let i = 0; i <= 360; i += 20) {
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

    // --- BRAKE DURATION LOGIC ---
    const brakeDuration = useMemo(() => {
        // If not braking, duration is 0
        if (vizBrake <= 0 || !raceData?.drivers) return 0;

        const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
        if (!driver || !driver.telemetry || driver.telemetry.length === 0) return 0;

        // 1. Find current index (Binary Search)
        let low = 0;
        let high = driver.telemetry.length - 2;
        let index = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (driver.telemetry[mid].t <= currentTime) {
                index = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (index === -1) return 0;

        // 2. Look backwards to find start of braking
        let startTime = driver.telemetry[index].t;
        let limit = 100; // safety break

        for (let i = index; i >= 0 && limit > 0; i--) {
            // Check raw telemetry brake value
            if (driver.telemetry[i].brake <= 0) {
                break;
            }
            startTime = driver.telemetry[i].t;
            limit--;
        }

        return currentTime - startTime;
    }, [raceData, focusedDriver, currentTime, vizBrake]);

    const brakeColor = brakeDuration < 300 ? '#f97316' : '#ef4444';



    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
                <filter id="needleGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                {/* Mask for Gear Carousel */}
                <linearGradient id="carouselMask" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="white" stopOpacity="0" />
                    <stop offset="25%" stopColor="white" stopOpacity="1" />
                    <stop offset="75%" stopColor="white" stopOpacity="1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>

                {/* Vertical Gradients */}
                <linearGradient id="throttleGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="brakeGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={brakeColor} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={brakeColor} stopOpacity={1} />
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

                {/* --- RPM GAUGE (Inner Ring) --- */}
                {/* Background */}
                <Arc
                    innerRadius={rpmInner}
                    outerRadius={rpmRadius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={Math.PI * 0.75}
                    fill="#0f172a"
                    opacity={0.5}
                    cornerRadius={2}
                />
                {/* Active RPM */}
                <Arc
                    innerRadius={rpmInner}
                    outerRadius={rpmRadius}
                    startAngle={-Math.PI * 0.75}
                    endAngle={rpmScale(rpm)}
                    fill={rpm > 11500 ? "#a855f7" : rpm > 10500 ? "#ef4444" : "#22c55e"}
                    cornerRadius={2}
                    opacity={0.8}
                />

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
                                x={Math.cos(speedScale(tick.value) - Math.PI / 2) * (radius + 20)}
                                y={Math.sin(speedScale(tick.value) - Math.PI / 2) * (radius + 20)}
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

                {/* --- REV LIGHTS (Bottom) --- */}
                {/* Placed below the speed text/circle */}
                <Group top={radius + 20}>
                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                    </div>
                    {/* Thin Line Style */}
                    <g transform="translate(-37, 0)">
                        {ledData.map((led, i) => (
                            <rect
                                key={i}
                                x={i * 5} // Tighter spacing (5px step)
                                y={0}
                                width={3} // Thinner width
                                height={1.5} // Ultra thin height
                                rx={0.5}
                                fill={led.isOn ? led.color : '#1e293b'}
                                style={{
                                    filter: led.isOn ? `drop-shadow(0 0 4px ${led.color})` : 'none',
                                    transition: 'fill 0.05s linear'
                                }}
                            />
                        ))}
                    </g>
                </Group>

                {/* --- GEAR CAROUSEL (Upper Center) --- */}
                <Group top={-40}>
                    <svg x={-60} y={-30} width={120} height={60} style={{ overflow: 'visible' }}>
                        <mask id="gearMask">
                            <rect x={0} y={0} width={120} height={60} fill="url(#carouselMask)" />
                        </mask>
                        <g mask="url(#gearMask)">
                            {GEARS.map((g, i) => {
                                const offset = (i - currentGearIndex) * 25;
                                const isActive = i === currentGearIndex;
                                const dist = Math.abs(i - currentGearIndex);

                                return (
                                    <text
                                        key={g}
                                        x={60 + offset}
                                        y={45}
                                        textAnchor="middle"
                                        fill={isActive ? "#e2e8f0" : "#64748b"}
                                        fontSize={isActive ? 32 : 14}
                                        fontWeight={isActive ? 900 : 700}
                                        fontFamily="Outfit"
                                        style={{
                                            opacity: isActive ? 1 : Math.max(0, 0.4 - dist * 0.2),
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            filter: isActive ? 'drop-shadow(0 0 8px rgba(226, 232, 240, 0.3))' : 'none'
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
                {/* LEFT SIDE: THROTTLE */}
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
                    endAngle={-Math.PI * 0.75 + (Math.PI * 0.75 * (vizThrottle / 100))}
                    fill="url(#throttleGrad)"
                    cornerRadius={4}
                />
                <text
                    x={Math.cos(145 * (Math.PI / 180)) * (telemetryInner + 7.5)}
                    y={Math.sin(145 * (Math.PI / 180)) * (telemetryInner + 7.5)}
                    transform={`rotate(55, ${Math.cos(145 * (Math.PI / 180)) * (telemetryInner + 7.5)}, ${Math.sin(145 * (Math.PI / 180)) * (telemetryInner + 7.5)})`}
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={800}
                    fontFamily="Inter"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                >
                    THR
                </text>

                {/* RIGHT SIDE: BRAKE */}
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={0}
                    endAngle={Math.PI * 0.75}
                    fill="#1e293b" opacity={0.3}
                    cornerRadius={4}
                />
                <Arc
                    innerRadius={telemetryInner}
                    outerRadius={telemetryOuter}
                    startAngle={Math.PI * 0.75 - (Math.PI * 0.75 * (vizBrake / 100))}
                    endAngle={Math.PI * 0.75}
                    fill="url(#brakeGrad)"
                    cornerRadius={4}
                />
                <text
                    x={Math.cos(35 * (Math.PI / 180)) * (telemetryInner + 7.5)}
                    y={Math.sin(35 * (Math.PI / 180)) * (telemetryInner + 7.5)}
                    transform={`rotate(-55, ${Math.cos(35 * (Math.PI / 180)) * (telemetryInner + 7.5)}, ${Math.sin(35 * (Math.PI / 180)) * (telemetryInner + 7.5)})`}
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={800}
                    fontFamily="Inter"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                >
                    BRK
                </text>


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
                    fontFamily="Titillium Web"
                >
                    KM/H
                </text>

                {/* RPM Label */}
                <text
                    y={radius + 35}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="JetBrains Mono"
                >
                    {Math.round(rpm)} RPM
                </text>

            </Group>
        </svg>
    );
};
