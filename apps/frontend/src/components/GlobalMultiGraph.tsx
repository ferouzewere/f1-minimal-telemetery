import React, { useMemo, memo } from 'react';
import { Group } from '@visx/group';
import { Circle, LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface GlobalMultiGraphProps {
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

export const GlobalMultiGraph: React.FC<GlobalMultiGraphProps> = memo(({ width, height }) => {
    const raceData = useRaceStore(state => state.raceData);
    const currentTime = useRaceStore(state => state.currentTime);
    const trackLength = useRaceStore(state => state.trackLength);

    const { driverData, maxDist } = useMemo(() => {
        if (!raceData) return { driverData: [], maxDist: trackLength };

        let currentMaxDist = 0;

        const data = raceData.drivers.map((driver) => {
            const frame = getInterpolatedFrame(driver.telemetry, currentTime).frame;
            // Current lap for trail filtering
            const currentLap = frame.lap;

            const safeTrackLength = trackLength > 0 ? trackLength : 1;
            const dist = (frame.dist % safeTrackLength) || 0;
            if (dist > currentMaxDist) currentMaxDist = dist;

            // Filter points for the TRAIL (current driver, current lap, up to current time)
            let trail = driver.telemetry.filter(t =>
                t.lap === currentLap && t.t <= currentTime
            ).map(t => ({
                dist: t.dist % safeTrackLength,
                speed: t.speed || 0
            })).filter(t => !isNaN(t.dist) && !isNaN(t.speed));

            // Strict sorting and filtering to prevent "lines ahead of dot"
            trail.sort((a, b) => a.dist - b.dist);
            trail = trail.filter(t => t.dist < dist); // Strictly less than current

            // Ensure the trail connects to current interpolated point
            trail.push({ dist, speed: frame.speed || 0 });

            return {
                abbr: driver.driver_abbr,
                dist,
                speed: frame.speed || 0,
                color: TEAM_COLORS[driver.team] || '#ffffff',
                trail
            };
        }).filter(d => !isNaN(d.dist) && !isNaN(d.speed));

        return { driverData: data, maxDist: currentMaxDist };
    }, [raceData, currentTime, trackLength]);

    // Layout Constants
    const PADDING_X = 48;
    const PADDING_Y = 32;
    const HEADER_HEIGHT = 42;

    const graphWidth = Math.max(0, width - PADDING_X);
    const graphHeight = Math.max(0, height - PADDING_Y - HEADER_HEIGHT);

    const xScale = useMemo(() => {
        const domainMax = isNaN(maxDist) || !isFinite(maxDist) ? 200 : Math.max(maxDist, 200);
        return scaleLinear({
            domain: [0, domainMax],
            range: [60, graphWidth - 20],
        });
    }, [graphWidth, maxDist]);

    const yScale = useMemo(() => scaleLinear({
        domain: [0, 360],
        range: [graphHeight - 30, 20],
    }), [graphHeight]);

    // Dynamic Grid Lines
    const gridLines = useMemo(() => {
        const ticks = [];
        const maxDomain = xScale.domain()[1];
        for (let i = 0; i <= 3500; i += 500) {
            if (i <= maxDomain) ticks.push(i);
        }
        return ticks.map((d, i) => (
            <React.Fragment key={i}>
                <line
                    x1={xScale(d)} x2={xScale(d)}
                    y1={20} y2={graphHeight - 30}
                    stroke="rgba(255,255,255,0.1)" strokeDasharray="2,4"
                />
                <text
                    x={xScale(d)}
                    y={graphHeight - 15}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize={10}
                    fontFamily="monospace"
                >
                    {d}m
                </text>
            </React.Fragment>
        ));
    }, [xScale, graphHeight]);

    if (driverData.length === 0) return null;

    return (
        <div className="global-multi-graph">


            <svg width={graphWidth} height={graphHeight} style={{ overflow: 'visible' }}>
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {driverData.map(d => (
                        <LinearGradient
                            key={`grad-${d.abbr}`}
                            id={`grad-${d.abbr}`}
                            from={d.color}
                            to={d.color}
                            fromOpacity={0}
                            toOpacity={1}
                            // Horizontal gradient relative to the bounding box of the path doesn't work well for dynamic time
                            // We usually want gradient along the path, which SVG doesn't support easily.
                            // BUT, for a simplified "fade tail" effect, a Left-to-Right gradient works 
                            // if the path is mostly growing L-to-R.
                            // Since X is distance, it mostly is.
                            x1="0%" y1="0%" x2="100%" y2="0%"
                        />
                    ))}
                </defs>

                {gridLines}

                <Group>
                    {driverData.map((d) => (
                        <LinePath
                            key={`trail-${d.abbr}`}
                            data={d.trail}
                            x={p => xScale(p.dist)}
                            y={p => yScale(p.speed)}
                            stroke={`url(#grad-${d.abbr})`}
                            strokeWidth={3}
                            curve={curveMonotoneX}
                            style={{ filter: "brightness(1.5)" }}
                        />
                    ))}

                    {/* Render Dots with Glow and Pulse */}
                    {driverData.map((d) => (
                        <Group key={d.abbr}>
                            {/* Inner Pulsing Aura */}
                            <Circle
                                cx={xScale(d.dist)}
                                cy={yScale(d.speed)}
                                r={5}
                                fill={d.color}
                                filter="url(#glow)"
                            >
                                <animate
                                    attributeName="r"
                                    values="4;7;4"
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="opacity"
                                    values="0.6;1;0.6"
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                />
                            </Circle>
                            {/* Core Dot */}
                            <circle
                                cx={xScale(d.dist)}
                                cy={yScale(d.speed)}
                                r={3}
                                fill="#fff"
                                style={{ filter: 'drop-shadow(0 0 2px #fff)' }}
                            />
                            {/* Driver ID Label */}
                            <text
                                x={xScale(d.dist)}
                                y={yScale(d.speed) - 18}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize={11}
                                fontWeight={900}
                                fontFamily="Outfit, sans-serif"
                                style={{
                                    pointerEvents: 'none',
                                    textShadow: `0 0 8px ${d.color}, 0 0 2px #000`
                                }}
                            >
                                {d.abbr}
                            </text>
                        </Group>
                    ))}
                </Group>
            </svg>

            {/* Shared Minimal Labels */}
            <div style={{ position: 'absolute', top: 5, left: 10, fontSize: 10, fontWeight: 900, color: '#3b82f6', letterSpacing: '0.1em' }}>
                LIVE PULSE • SPEED/DIST
            </div>
        </div>
    );
});
