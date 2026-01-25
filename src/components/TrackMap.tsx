import React, { useMemo } from 'react';
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

export const TrackMap: React.FC<TrackMapProps> = ({ width, height }) => {
    // Selective state picking to prevent unnecessary re-renders
    const raceData = useRaceStore(state => state.raceData);
    const currentTime = useRaceStore(state => state.currentTime);
    const focusedDriver = useRaceStore(state => state.focusedDriver);
    const setFocusedDriver = useRaceStore(state => state.setFocusedDriver);
    const circuitMetadata = useRaceStore(state => state.circuitMetadata);

    // Define track points with sector info (Static per session)
    const trackPoints = useMemo(() => {
        if (!raceData || !raceData.drivers[0]) return [];
        return raceData.drivers[0].telemetry
            .filter(f => !isNaN(f.x) && !isNaN(f.y))
            .map(f => ({
                x: f.x,
                y: f.y,
                dist: f.dist,
                sector: getSector(f.dist, circuitMetadata)
            }));
    }, [raceData, circuitMetadata]);

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
        }).filter(pos => !isNaN(pos.x) && !isNaN(pos.y));
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

    const vbWidth = 1000 / viewport.zoom;
    const vbHeight = 700 / viewport.zoom;
    const vbX = viewport.x - vbWidth / 2;
    const vbY = viewport.y - vbHeight / 2;



    const TacticalUnderlay = useMemo(() => {
        // Use VIEWPORT bounds instead of track bounds for the background
        const width = vbWidth;
        const height = vbHeight;
        const x = vbX;
        const y = vbY;

        const { minX, maxX, minY, maxY } = trackBounds;
        const trackW = isFinite(maxX - minX) ? (maxX - minX) : 0;
        const trackH = isFinite(maxY - minY) ? (maxY - minY) : 0;

        // PROCEDURAL GENERATION: Create "Track Furniture" along the spline
        const trackFeatures: any[] = [];

        if (trackPoints.length > 100) {
            // Sample points along the track to place features
            // We skip points to avoid overcrowding
            const step = Math.floor(trackPoints.length / 40);

            for (let i = 0; i < trackPoints.length - step; i += step) {
                const p1 = trackPoints[i];
                const p2 = trackPoints[i + 5] || trackPoints[i + 1]; // Look ahead for tangent

                // Calculate tangent vector
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) continue;

                // Normalized normal vector (perpendicular)
                // Rotate 90 degrees: (x, y) -> (-y, x)
                const nx = -dy / len;
                const ny = dx / len;

                // Determine side (inside or outside track) based on sector or random
                // We'll alternate sides or pick 'outside' for grandstands
                const isOutside = i % (step * 2) === 0;
                const offsetDist = isOutside ? 60 : -60; // Distance from track center

                const featureX = p1.x + nx * offsetDist;
                const featureY = p1.y + ny * offsetDist;
                const rotation = Math.atan2(dy, dx) * 180 / Math.PI; // Align with track

                // Add diverse features
                const type = (i % 3 === 0) ? 'grandstand' : (i % 5 === 0 ? 'tech' : 'light');

                trackFeatures.push({
                    x: featureX,
                    y: featureY,
                    rotation: rotation,
                    type: type,
                    // Dimensions based on type
                    w: type === 'grandstand' ? 80 : (type === 'tech' ? 40 : 10),
                    h: type === 'grandstand' ? 20 : (type === 'tech' ? 40 : 10),
                });
            }
        }

        return (
            <Group style={{ pointerEvents: 'none' }}>
                {/* Visual Base - Covers entire VIEWPORT (Infinite Background) */}
                <rect
                    x={x - width} y={y - height}
                    width={width * 3} height={height * 3}
                    fill="#020617" opacity={0.4}
                />

                {/* Tactical Grid - Covers entire VIEWPORT (Infinite Background) */}
                <rect
                    x={x - width}
                    y={y - height}
                    width={width * 3}
                    height={height * 3}
                    fill="url(#tacticalGrid)"
                    opacity={0.7}
                />

                {/* PROCEDURAL TRACKSIDE FEATURES */}
                {trackFeatures.map((f, i) => (
                    <Group key={i} transform={`rotate(${f.rotation}, ${f.x}, ${f.y})`}>
                        <rect
                            x={f.x - f.w / 2}
                            y={f.y - f.h / 2}
                            width={f.w}
                            height={f.h}
                            fill={f.type === 'grandstand' ? '#1e293b' : (f.type === 'tech' ? '#0f172a' : '#334155')}
                            stroke={f.type === 'light' ? '#facc15' : '#0ea5e9'}
                            strokeWidth={f.type === 'light' ? 2 : 0.5}
                            strokeOpacity={f.type === 'light' ? 0.6 : 0.3}
                            opacity={0.5}
                        />
                        {/* Detail lines for grandstands */}
                        {f.type === 'grandstand' && (
                            <line
                                x1={f.x - f.w / 2} y1={f.y}
                                x2={f.x + f.w / 2} y2={f.y}
                                stroke="#0ea5e9" strokeWidth={0.5} opacity={0.2}
                            />
                        )}
                    </Group>
                ))}

                {/* Coordinate Crosshairs - Relative to TRACK bounds */}
                {[0.25, 0.5, 0.75].map(v => (
                    <React.Fragment key={v}>
                        <line
                            x1={minX + trackW * v} y1={minY - 1000}
                            x2={minX + trackW * v} y2={maxY + 1000}
                            stroke="#0ea5e9" strokeWidth={0.5} strokeDasharray="5,5" opacity={0.2}
                        />
                        <line
                            x1={minX - 1000} y1={minY + trackH * v}
                            x2={maxX + 1000} y2={minY + trackH * v}
                            stroke="#0ea5e9" strokeWidth={0.5} strokeDasharray="5,5" opacity={0.2}
                        />
                        <text
                            x={minX + trackW * v + 5} y={minY - 10}
                            fontSize={7} fill="#64748b" opacity={0.5}
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                        >
                            {(144.9 + v * 0.1).toFixed(4)}°E
                        </text>
                        <text
                            x={minX - 70} y={minY + trackH * v - 5}
                            fontSize={7} fill="#64748b" opacity={0.5}
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                        >
                            {(37.8 + v * 0.1).toFixed(4)}°S
                        </text>
                    </React.Fragment>
                ))}
            </Group>
        );
    }, [trackBounds, vbX, vbY, vbWidth, vbHeight, trackPoints]); // Added trackPoints dependency



    if (!raceData || trackPoints.length === 0) return null;

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

                <pattern id="tacticalGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#0ea5e9" opacity="0.6" />
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.2" />
                </pattern>

                <radialGradient
                    id="trackFade"
                    cx={viewport.x}
                    cy={viewport.y}
                    r={Math.max(vbWidth, vbHeight) * 0.8}
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>

                <mask id="vignetteMask" maskUnits="userSpaceOnUse">
                    <rect x={vbX - 100} y={vbY - 100} width={vbWidth + 200} height={vbHeight + 200} fill="url(#trackFade)" />
                </mask>
            </defs>

            <Group>
                {/* Background Tactical Layer */}
                <Group mask="url(#vignetteMask)">
                    {TacticalUnderlay}
                </Group>



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
};
