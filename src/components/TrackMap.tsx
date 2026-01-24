import React, { useMemo, memo } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveCardinal } from '@visx/curve';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';
import { getSector } from '../utils/constants';

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

export const TrackMap: React.FC<TrackMapProps> = memo(({ width, height }) => {
    // Selective state picking to prevent unnecessary re-renders
    const raceData = useRaceStore(state => state.raceData);
    const currentTime = useRaceStore(state => state.currentTime);
    const focusedDriver = useRaceStore(state => state.focusedDriver);
    const setFocusedDriver = useRaceStore(state => state.setFocusedDriver);

    // Define track points with sector info (Static per session)
    const trackPoints = useMemo(() => {
        if (!raceData || !raceData.drivers[0]) return [];
        return raceData.drivers[0].telemetry.map(f => ({
            x: f.x,
            y: f.y,
            dist: f.dist,
            sector: getSector(f.dist)
        }));
    }, [raceData]);

    // Segment track points for visual distinction (Static per session)
    const segments = useMemo(() => {
        if (trackPoints.length === 0) return [];
        const segs = [];
        let currentSeg = [trackPoints[0]];

        for (let i = 1; i < trackPoints.length; i++) {
            if (trackPoints[i].sector !== trackPoints[i - 1].sector) {
                currentSeg.push(trackPoints[i]); // Connect segment
                segs.push({ sector: trackPoints[i - 1].sector, points: currentSeg });
                currentSeg = [trackPoints[i]];
            } else {
                currentSeg.push(trackPoints[i]);
            }
        }
        segs.push({ sector: trackPoints[trackPoints.length - 1].sector, points: currentSeg });
        return segs;
    }, [trackPoints]);

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

    const trackBounds = useMemo(() => {
        if (trackPoints.length === 0) return { minX: 0, maxX: 1000, minY: 0, maxY: 700 };
        const xs = trackPoints.map(p => p.x);
        const ys = trackPoints.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }, [trackPoints]);

    const viewport = useMemo(() => {
        if (!raceData || !focusedDriver) {
            const centerX = (trackBounds.minX + trackBounds.maxX) / 2;
            const centerY = (trackBounds.minY + trackBounds.maxY) / 2;
            return { x: centerX, y: centerY, zoom: 0.95 };
        }

        const driver = raceData.drivers.find(d => d.driver_abbr === focusedDriver);
        if (!driver) return { x: 500, y: 350, zoom: 1 };
        const frame = getInterpolatedFrame(driver.telemetry, currentTime);

        return { x: frame.x, y: frame.y, zoom: 2.2 };
    }, [raceData, focusedDriver, currentTime, trackBounds]);

    if (!raceData || trackPoints.length === 0) return null;

    const vbWidth = 1000 / viewport.zoom;
    const vbHeight = 700 / viewport.zoom;
    const vbX = viewport.x - vbWidth / 2;
    const vbY = viewport.y - vbHeight / 2;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
            style={{ transition: 'viewBox 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
            <defs>
                <filter id="carGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <Group>
                {/* Static Track Layer */}
                {segments.map((seg, i) => (
                    <LinePath
                        key={i}
                        data={seg.points}
                        x={(d: any) => d.x}
                        y={(d: any) => d.y}
                        stroke={seg.sector === 2 ? "#1e293b" : "#334155"}
                        strokeOpacity={0.4}
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        curve={curveCardinal}
                    />
                ))}

                <LinePath
                    data={trackPoints}
                    x={(d: any) => d.x}
                    y={(d: any) => d.y}
                    stroke="#0f172a"
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    curve={curveCardinal}
                />

                {/* Leader Ghost Layer (for comparison) */}
                {(() => {
                    if (!raceData || driverPositions.length === 0) return null;
                    // Let's calculate total distance in TrackMap as well to find the leader
                    const trackLength = useRaceStore.getState().trackLength;
                    const leaderDriver = raceData.drivers.reduce((prev, curr) => {
                        const framePrev = getInterpolatedFrame(prev.telemetry, currentTime);
                        const frameCurr = getInterpolatedFrame(curr.telemetry, currentTime);
                        const distPrev = (framePrev.lap - 1) * trackLength + framePrev.dist;
                        const distCurr = (frameCurr.lap - 1) * trackLength + frameCurr.dist;
                        return distPrev > distCurr ? prev : curr;
                    });

                    const leaderFrame = getInterpolatedFrame(leaderDriver.telemetry, currentTime);
                    const isLeaderFocused = focusedDriver === leaderDriver.driver_abbr;

                    if (isLeaderFocused) return null; // Don't show ghost if focusing on leader

                    return (
                        <Group key="leader-ghost" top={leaderFrame.y} left={leaderFrame.x} style={{ opacity: 0.3, pointerEvents: 'none' }}>
                            <circle
                                r={5}
                                fill="#ffffff"
                                stroke="#ffffff"
                                strokeWidth={1}
                            />
                            <text
                                y={12}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize={8}
                                fontWeight={700}
                                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                            >
                                LEADER
                            </text>
                        </Group>
                    );
                })()}

                {/* Car Indicators (Dynamic Layer) */}
                {driverPositions.map((pos) => {
                    const isFocused = focusedDriver === pos.abbr;
                    return (
                        <Group
                            key={pos.abbr}
                            top={pos.y}
                            left={pos.x}
                            style={{ zIndex: isFocused ? 100 : 1, cursor: 'pointer' }}
                            onClick={() => setFocusedDriver(isFocused ? null : pos.abbr)}
                        >
                            {pos.isPit && (
                                <Group>
                                    <circle r={15} fill="none" stroke="#facc15" strokeWidth={1} strokeDasharray="2,2">
                                        <animate attributeName="r" from="10" to="25" dur="1.5s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                                    </circle>
                                    <text
                                        y={18}
                                        textAnchor="middle"
                                        fill="#facc15"
                                        fontSize={8}
                                        fontWeight={800}
                                        style={{ fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none' }}
                                    >
                                        PIT
                                    </text>
                                </Group>
                            )}
                            <circle
                                r={isFocused ? 10 : 5}
                                fill={pos.color}
                                stroke={isFocused ? "#ffffff" : "none"}
                                strokeWidth={isFocused ? 2 : 0}
                                style={{
                                    filter: isFocused ? 'url(#carGlow)' : 'none',
                                    opacity: isFocused ? 1 : 0.6,
                                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            />
                            {(isFocused || viewport.zoom > 1.5) && (
                                <text
                                    y={-18}
                                    textAnchor="middle"
                                    fill="#ffffff"
                                    fontSize={12}
                                    fontWeight={800}
                                    style={{ fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none' }}
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
});
