import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveCardinal } from '@visx/curve';
import { motion } from 'framer-motion';
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
    const currentTrackStatus = useRaceStore(state => state.currentTrackStatus);
    const currentWeather = useRaceStore(state => state.currentWeather);

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
                color: driver.team_color || TEAM_COLORS[driver.team] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
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
            const step = Math.floor(trackPoints.length / 40);

            for (let i = 0; i < trackPoints.length - step; i += step) {
                const p1 = trackPoints[i];
                const p2 = trackPoints[i + 5] || trackPoints[i + 1];

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) continue;

                const nx = -dy / len;
                const ny = dx / len;

                const isOutside = i % (step * 2) === 0;
                const offsetDist = isOutside ? 60 : -60;

                const featureX = p1.x + nx * offsetDist;
                const featureY = p1.y + ny * offsetDist;
                const rotation = Math.atan2(dy, dx) * 180 / Math.PI;

                const type = (i % 3 === 0) ? 'grandstand' : (i % 5 === 0 ? 'tech' : 'light');

                trackFeatures.push({
                    x: featureX,
                    y: featureY,
                    rotation: rotation,
                    type: type,
                    w: type === 'grandstand' ? 80 : (type === 'tech' ? 40 : 10),
                    h: type === 'grandstand' ? 20 : (type === 'tech' ? 40 : 10),
                });
            }
        }

        return (
            <Group style={{ pointerEvents: 'none' }}>
                {/* Visual Base - Massive coverage to ensure no edges show during fast tracking */}
                <rect
                    x={x - width * 4} y={y - height * 4}
                    width={width * 9} height={height * 9}
                    fill="#020617" opacity={0.6}
                />

                {/* Tactical Grid - Massive coverage */}
                <rect
                    x={x - width * 4}
                    y={y - height * 4}
                    width={width * 9}
                    height={height * 9}
                    fill="url(#tacticalGrid)"
                    opacity={0.9}
                />

                {/* Ambient Intelligence Pulse - Subtly Blue */}
                <rect
                    x={x - width * 2} y={y - height * 2}
                    width={width * 5} height={height * 5}
                    fill="rgba(59, 130, 246, 0.05)"
                >
                    <animate
                        attributeName="opacity"
                        values="0.01;0.1;0.01"
                        dur="8s"
                        repeatCount="indefinite"
                    />
                </rect>

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

                {/* Coordinate Crosshairs */}
                {[0.25, 0.5, 0.75].map(v => (
                    <React.Fragment key={v}>
                        <line
                            x1={minX + trackW * v} y1={minY - 5000}
                            x2={minX + trackW * v} y2={maxY + 5000}
                            stroke="#0ea5e9" strokeWidth={1} strokeDasharray="5,5" opacity={0.15}
                        />
                        <line
                            x1={minX - 5000} y1={minY + trackH * v}
                            x2={maxX + 5000} y2={minY + trackH * v}
                            stroke="#0ea5e9" strokeWidth={1} strokeDasharray="5,5" opacity={0.15}
                        />
                    </React.Fragment>
                ))}
            </Group>
        );
    }, [trackBounds, vbX, vbY, vbWidth, vbHeight, trackPoints]);



    if (!raceData || trackPoints.length === 0) return null;

    return (
        <motion.svg
            width={width}
            height={height}
            animate={{ viewBox: `${vbX} ${vbY} ${vbWidth} ${vbHeight}` }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        >
            <defs>
                <filter id="carGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* ZOOM-INVARIANT TACTICAL GRID */}
                <pattern
                    id="tacticalGrid"
                    width={60 / viewport.zoom}
                    height={60 / viewport.zoom}
                    patternUnits="userSpaceOnUse"
                >
                    <circle cx="1" cy="1" r="0.5" fill="#0ea5e9" opacity="0.4" />
                    <path
                        d={`M ${60 / viewport.zoom} 0 L 0 0 0 ${60 / viewport.zoom}`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth={0.5 / viewport.zoom}
                        opacity="0.2"
                    />
                </pattern>

                <radialGradient
                    id="trackFade"
                    cx={viewport.x}
                    cy={viewport.y}
                    r={Math.max(vbWidth, vbHeight) * 1.5}
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                    <stop offset="60%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>

                <mask id="vignetteMask" maskUnits="userSpaceOnUse">
                    <rect x={vbX - 2000} y={vbY - 2000} width={vbWidth + 4000} height={vbHeight + 4000} fill="url(#trackFade)" />
                </mask>

                <filter id="yellowFlagGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#facc15" floodOpacity="0.5" result="flood" />
                    <feComposite in="flood" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                <pattern id="rainNoise" width="20" height="20" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="1" y2="4" stroke="#3b82f6" strokeWidth="0.5" opacity="0.4">
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="0,0" to="20,80"
                            dur="0.5s"
                            repeatCount="indefinite"
                        />
                    </line>
                </pattern>
            </defs>

            <Group>
                {/* Background Tactical Layer - REMOVED MASK to ensure visibility on zoom */}
                {TacticalUnderlay}

                {/* Vignette Layer Apply only to weather or as a separate overlay if desired */}
                {/* For now, we want the grid to be constant and everywhere */}



                {/* Weather Overlay (Rain) */}
                {currentWeather?.rainfall && (
                    <Group>
                        <rect
                            x={vbX - 1000}
                            y={vbY - 1000}
                            width={vbWidth + 2000}
                            height={vbHeight + 2000}
                            fill="rgba(59, 130, 246, 0.08)"
                            style={{ pointerEvents: 'none' }}
                        />
                        <rect
                            x={vbX - 1000}
                            y={vbY - 1000}
                            width={vbWidth + 2000}
                            height={vbHeight + 2000}
                            fill="url(#rainNoise)"
                            style={{ pointerEvents: 'none' }}
                        />
                    </Group>
                )}

                {/* Static Track Layer */}
                {segments.map((seg, i) => {
                    let trackBaseColor = "#334155";
                    let filter = undefined;

                    if (currentTrackStatus?.status === "2") { // Yellow flag
                        trackBaseColor = "#facc15";
                        filter = "url(#yellowFlagGlow)";
                    } else if (currentTrackStatus?.status === "4" || currentTrackStatus?.status === "6") { // SC / VSC
                        trackBaseColor = "#94a3b8";
                    } else if (currentTrackStatus?.status === "5") { // Red flag
                        trackBaseColor = "#ef4444";
                    }

                    return (
                        <LinePath
                            key={i}
                            data={seg.points}
                            x={(d: any) => d.x}
                            y={(d: any) => d.y}
                            stroke={trackBaseColor}
                            strokeOpacity={currentTrackStatus?.status ? 0.8 : 0.4}
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            curve={curveCardinal}
                            style={{
                                filter,
                                transition: 'stroke 0.5s ease, stroke-opacity 0.5s ease'
                            }}
                        />
                    );
                })}

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
                                    fillOpacity={focusedDriver && !isFocused ? 0.3 : 1}
                                    fontSize={12}
                                    fontWeight={800}
                                    style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        pointerEvents: 'none',
                                        transition: 'fill-opacity 0.5s ease'
                                    }}
                                >
                                    {pos.abbr}
                                </text>
                            )}
                        </Group>
                    );
                })}
            </Group>
        </motion.svg>
    );
};
