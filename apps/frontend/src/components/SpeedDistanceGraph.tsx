import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { scaleLinear } from '@visx/scale';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface SpeedGraphProps {
    width: number;
    height: number;
}

export const SpeedDistanceGraph: React.FC<SpeedGraphProps> = ({ width, height }) => {
    const raceData = useRaceStore(state => state.raceData);
    const focusedDriver = useRaceStore(state => state.focusedDriver);
    const currentTime = useRaceStore(state => state.currentTime);
    const trackLength = useRaceStore(state => state.trackLength);

    const WINDOW_SIZE = 2500; // 2.5km view window for better context
    const HISTORY_RATIO = 0.95; // Car sits at 95% position (leading edge)

    // Data selector with cumulative distance logic
    const { graphData, windowStart, windowEnd, currentCumulativeDist } = useMemo(() => {
        if (!raceData || !focusedDriver || !trackLength) {
            return { graphData: [], windowStart: 0, windowEnd: WINDOW_SIZE, currentCumulativeDist: 0 };
        }

        const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
        if (!driver) return { graphData: [], windowStart: 0, windowEnd: WINDOW_SIZE, currentCumulativeDist: 0 };

        const currentFrame = getInterpolatedFrame(driver.telemetry, currentTime).frame;
        const currentCumulative = (currentFrame.lap - 1) * trackLength + currentFrame.dist;

        const start = currentCumulative - WINDOW_SIZE * HISTORY_RATIO;
        const end = currentCumulative + WINDOW_SIZE * (1 - HISTORY_RATIO);

        // Map and filter for the rolling window, CAPPING at current distance
        const data = driver.telemetry
            .map(t => ({
                absDist: (t.lap - 1) * trackLength + t.dist,
                speed: t.speed || 0
            }))
            .filter(t => t.absDist >= start - 100 && t.absDist <= currentCumulative) // Clip future data
            .sort((a, b) => a.absDist - b.absDist);

        // Ensure the path draws right up to the car's current position
        if (data.length > 0 && data[data.length - 1].absDist < currentCumulative) {
            data.push({ absDist: currentCumulative, speed: currentFrame.speed || 0 });
        }

        return {
            graphData: data,
            windowStart: start,
            windowEnd: end,
            currentCumulativeDist: currentCumulative
        };
    }, [raceData, focusedDriver, currentTime, trackLength]);

    // Scales
    const xScale = useMemo(() => scaleLinear({
        range: [0, width],
        domain: [windowStart, windowEnd],
    }), [width, windowStart, windowEnd]);

    const yScale = useMemo(() => scaleLinear({
        range: [height, 0],
        domain: [0, 360], // Max speed approx 360 km/h
    }), [height]);

    // Current Position Indicator
    const currentPos = useMemo(() => {
        const x = xScale(currentCumulativeDist);
        const driver = raceData?.drivers.find(d => d.driver_abbr === focusedDriver);
        const speed = driver ? getInterpolatedFrame(driver.telemetry, currentTime).frame.speed : 0;
        const y = yScale(speed);

        return {
            x: isFinite(x) ? x : 0,
            y: isFinite(y) ? y : height
        };
    }, [currentCumulativeDist, xScale, yScale, raceData, focusedDriver, currentTime, height]);

    return (
        <div className="speed-distance-graph" style={{ width, height, position: 'relative' }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <filter id="glow-focused" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <Group>
                    {/* Background Grid Lines */}
                    {[0, 100, 200, 300].map(s => (
                        <line
                            key={s}
                            x1={0} y1={yScale(s)}
                            x2={width} y2={yScale(s)}
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                        />
                    ))}

                    <AreaClosed
                        data={graphData}
                        x={d => xScale(d.absDist)}
                        y={d => yScale(d.speed)}
                        yScale={yScale}
                        strokeWidth={0}
                        fill="url(#speedGradient)"
                        curve={curveMonotoneX}
                    />

                    <LinePath
                        data={graphData}
                        x={d => xScale(d.absDist)}
                        y={d => yScale(d.speed)}
                        stroke="#3b82f6"
                        strokeWidth={3}
                        curve={curveMonotoneX}
                        style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' }}
                    />

                    {/* Current Position Marker with Pulse */}
                    <line
                        x1={currentPos.x} y1={0}
                        x2={currentPos.x} y2={height}
                        stroke="#ffffff"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.3}
                    />

                    <circle
                        cx={currentPos.x}
                        cy={currentPos.y}
                        r={6}
                        fill="#3b82f6"
                        filter="url(#glow-focused)"
                    >
                        <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
                    </circle>
                    <circle
                        cx={currentPos.x}
                        cy={currentPos.y}
                        r={3}
                        fill="#ffffff"
                    />
                </Group>
            </svg>

            {/* Minimal Labels */}
            <div style={{ position: 'absolute', top: 5, left: 10, fontSize: 10, fontWeight: 900, color: '#3b82f6', letterSpacing: '0.1em' }}>
                LIVE PULSE • SPEED/DIST
            </div>
        </div>
    );
};
