import { useMemo, Fragment } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { curveCardinal } from '@visx/curve';
import { motion } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';
import { getSector } from '../utils/constants';

interface TrackMapProps {
    width: number;
    height: number;
    verticalOffset?: number;
}

interface TrackPoint {
    x: number;
    y: number;
    dist: number;
    isGap: boolean;
    sector: number;
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

export const TrackMap = ({ width, height, verticalOffset = 0 }: TrackMapProps) => {
    // Selective state picking to prevent unnecessary re-renders
    const raceData = useRaceStore(state => state.raceData);
    const focusedDriver = useRaceStore(state => state.focusedDriver);
    const setFocusedDriver = useRaceStore(state => state.setFocusedDriver);
    const circuitMetadata = useRaceStore(state => state.circuitMetadata);
    const currentTrackStatus = useRaceStore(state => state.currentTrackStatus);
    const currentWeather = useRaceStore(state => state.currentWeather);

    const trackLayout = useRaceStore(state => state.trackLayout);

    // Define track points with sector info (Static per session)
    const trackPoints = useMemo<TrackPoint[]>(() => {
        // Use dedicated track layout if available (Live Mode)
        if (trackLayout && trackLayout.length > 0) {
            return trackLayout.map(p => ({
                x: p.x,
                y: p.y,
                dist: p.dist,
                isGap: (p as any).is_gap || false,
                sector: getSector(p.dist, circuitMetadata)
            }));
        }

        if (!raceData || !raceData.drivers[0]) return [];
        return raceData.drivers[0].telemetry
            .filter(f => !isNaN(f.x) && !isNaN(f.y))
            .map(f => ({
                x: f.x,
                y: f.y,
                dist: f.dist,
                isGap: false,
                sector: getSector(f.dist, circuitMetadata)
            }));
    }, [raceData, circuitMetadata, trackLayout]);

    // Segment track points for visual distinction (Static per session)
    const segments = useMemo(() => {
        if (trackPoints.length === 0) return [];
        const segs = [];
        let currentSeg = [trackPoints[0]];

        for (let i = 1; i < trackPoints.length; i++) {
            const p = trackPoints[i];
            const prev = trackPoints[i - 1];

            // Calculate Euclidean distance to detect unflagged gaps
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            const distSq = dx * dx + dy * dy;
            const isGap = p.isGap || distSq > 40000; // 200^2 = 40000

            if (p.sector !== prev.sector || isGap) {
                // If it's a gap, we don't connect. If it's just a sector change, we do.
                if (!isGap) currentSeg.push(p);

                segs.push({ sector: prev.sector, points: currentSeg });
                currentSeg = [p];
            } else {
                currentSeg.push(p);
            }
        }
        segs.push({ sector: trackPoints[trackPoints.length - 1].sector, points: currentSeg });
        return segs;
    }, [trackPoints]);

    const driverFrames = useRaceStore(state => state.driverFrames);
    const leaderAbbr = useRaceStore(state => state.leaderAbbr);

    const driverPositions = useMemo(() => {
        if (!raceData) return [];
        return raceData.drivers
            .filter(driver => driverFrames[driver.driver_abbr])
            .map((driver, idx) => {
                const frame = driverFrames[driver.driver_abbr]!;

                return {
                    abbr: driver.driver_abbr,
                    x: frame.x,
                    y: frame.y,
                    isPit: frame.is_pit,
                    drs: frame.drs,
                    color: driver.team_color || TEAM_COLORS[driver.team] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
                };
            }).filter(pos => !isNaN(pos.x) && !isNaN(pos.y));
    }, [raceData, driverFrames]);

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

        const frame = driverFrames[focusedDriver];
        if (!frame) return { x: 500, y: 350, zoom: 1 };

        return { x: frame.x, y: frame.y, zoom: 2.2 };
    }, [raceData, focusedDriver, driverFrames, trackBounds]);

    // --- DYNAMIC VIEWPORT CALCULATION (Magic Red Rectangle Fix) ---
    // Instead of forcing a 1000x700 ratio, we calculate the track's actual footprint
    // and adjust the viewbox to center it perfectly within the container's aspect ratio.
    const trackWidth = Math.max(trackBounds.maxX - trackBounds.minX, 100);
    const trackHeight = Math.max(trackBounds.maxY - trackBounds.minY, 100);
    const containerAspectRatio = width / height;

    // Padding ensures track is never touching the screen edges
    const padding = 1.25;

    let baseWidth = trackWidth * padding;
    let baseHeight = trackHeight * padding;

    if (baseWidth / baseHeight > containerAspectRatio) {
        // Track is wider than current screen aspect ratio
        baseHeight = baseWidth / containerAspectRatio;
    } else {
        // Track is taller than current screen aspect ratio
        baseWidth = baseHeight * containerAspectRatio;
    }

    const vbWidth = baseWidth / viewport.zoom;
    const vbHeight = baseHeight / viewport.zoom;

    const vbX = viewport.x - vbWidth / 2;
    const vbY = (viewport.y - vbHeight / 2) - (verticalOffset / viewport.zoom);



    // --- ENVIRONMENT CACHE ---
    // Procedural generation only happens once per track layout
    const trackFeatures = useMemo(() => {
        const features: any[] = [];
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
                features.push({
                    x: featureX,
                    y: featureY,
                    rotation: rotation,
                    type: type,
                    w: type === 'grandstand' ? 80 : (type === 'tech' ? 40 : 10),
                    h: type === 'grandstand' ? 20 : (type === 'tech' ? 40 : 10),
                });
            }
        }
        return features;
    }, [trackPoints]);

    const TacticalEnvironment = useMemo(() => (
        <Group style={{ pointerEvents: 'none' }}>
            {/* Massive Global Backdrop (Static) */}
            <rect
                x={-5000} y={-5000}
                width={15000} height={15000}
                fill="#020617"
            />

            {/* Tactical Grid (Static) */}
            <rect
                x={-5000} y={-5000}
                width={15000} height={15000}
                fill="url(#tacticalGrid)"
                opacity={0.8}
            />

            {/* Ambient Intelligence Pulse (Centered on Track) */}
            <circle
                cx={(trackBounds.minX + trackBounds.maxX) / 2}
                cy={(trackBounds.minY + trackBounds.maxY) / 2}
                r={Math.max(trackBounds.maxX - trackBounds.minX, trackBounds.maxY - trackBounds.minY) * 1.5}
                fill="rgba(59, 130, 246, 0.03)"
            >
                <animate attributeName="opacity" values="0.01;0.05;0.01" dur="10s" repeatCount="indefinite" />
            </circle>

            {/* STATIC PROCEDURAL TRACKSIDE FEATURES */}
            {trackFeatures.map((f, i) => (
                <Group key={i} transform={`rotate(${f.rotation}, ${f.x}, ${f.y})`}>
                    <rect
                        x={f.x - f.w / 2} y={f.y - f.h / 2} width={f.w} height={f.h}
                        fill={f.type === 'grandstand' ? '#1e293b' : (f.type === 'tech' ? '#0f172a' : '#334155')}
                        stroke={f.type === 'light' ? '#facc15' : '#0ea5e9'}
                        strokeWidth={f.type === 'light' ? 2 : 0.5}
                        strokeOpacity={0.6}
                        opacity={0.4}
                    />
                </Group>
            ))}

            {/* Static Coordinate Crosshairs */}
            {[0.25, 0.5, 0.75].map(v => (
                <Fragment key={v}>
                    <line
                        x1={trackBounds.minX + (trackBounds.maxX - trackBounds.minX) * v} y1={-5000}
                        x2={trackBounds.minX + (trackBounds.maxX - trackBounds.minX) * v} y2={5000}
                        stroke="#0ea5e9" strokeWidth={1} strokeDasharray="5,5" opacity={0.1}
                    />
                    <line
                        x1={-5000} y1={trackBounds.minY + (trackBounds.maxY - trackBounds.minY) * v}
                        x2={5000} y2={trackBounds.minY + (trackBounds.maxY - trackBounds.minY) * v}
                        stroke="#0ea5e9" strokeWidth={1} strokeDasharray="5,5" opacity={0.1}
                    />
                </Fragment>
            ))}
        </Group>
    ), [trackBounds, trackFeatures]);



    if (!raceData || (trackPoints.length === 0 && !circuitMetadata?.track_path)) return null;

    return (
        <motion.svg
            width={width}
            height={height}
            animate={{ viewBox: `${vbX} ${vbY} ${vbWidth} ${vbHeight}` }}
            transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1], // Quart easeOut for cinematic feel
            }}
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
                {/* MAGIC RED RECTANGLE - Bounds of our normalization space (1000x700) */}
                <rect
                    x={0}
                    y={0}
                    width={1000}
                    height={700}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={5}
                    strokeDasharray="20, 10"
                    opacity={0.3}
                />

                {/* TRACK BOUNDS - The actual data limits */}
                <rect
                    x={trackBounds.minX}
                    y={trackBounds.minY}
                    width={trackBounds.maxX - trackBounds.minX}
                    height={trackBounds.maxY - trackBounds.minY}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={1}
                    opacity={0.2}
                />

                {/* Optimized Static Environment */}
                {TacticalEnvironment}

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

                {/* Sector Markers (Enhanced Visibility) */}
                {circuitMetadata && trackPoints.length > 0 && [1, 2].map(sNum => {
                    try {
                        const dist = sNum === 1 ? circuitMetadata.sectors.s1_end : circuitMetadata.sectors.s2_end;
                        const point = trackPoints.reduce((prev, curr) =>
                            Math.abs(curr.dist - dist) < Math.abs(prev.dist - dist) ? curr : prev
                        );

                        // Calculate an offset position "beside" the track
                        const labelOffsetX = sNum === 1 ? -40 : 40;
                        const labelOffsetY = -40;

                        return (
                            <Group key={`sector-marker-${sNum}`}>
                                {/* Leader Line */}
                                <line
                                    x1={point.x} y1={point.y}
                                    x2={point.x + labelOffsetX} y2={point.y + labelOffsetY}
                                    stroke="rgba(255, 255, 255, 0.4)"
                                    strokeWidth={1}
                                    strokeDasharray="2,2"
                                />

                                {/* Marker Point on Track */}
                                <circle
                                    cx={point.x} cy={point.y}
                                    r={4}
                                    fill="#ffffff"
                                    stroke="#0f172a"
                                    strokeWidth={2}
                                />

                                {/* Offset Label Group */}
                                <Group top={point.y + labelOffsetY} left={point.x + labelOffsetX}>
                                    <rect
                                        x={-15} y={-10}
                                        width={30} height={20}
                                        rx={2}
                                        fill="rgba(15, 23, 42, 0.8)"
                                        stroke="rgba(255, 255, 255, 0.6)"
                                        strokeWidth={0.5}
                                    />
                                    <text
                                        dy=".33em"
                                        fontSize={10}
                                        fill="white"
                                        textAnchor="middle"
                                        style={{
                                            fontFamily: 'JetBrains Mono, monospace',
                                            letterSpacing: '0.05em'
                                        }}
                                    >
                                        S{sNum}
                                    </text>
                                </Group>
                            </Group>
                        );
                    } catch (e) { return null; }
                })}

                {/* Primary High-fidelity Track Path (from Provisioning) */}
                {circuitMetadata?.track_path && (
                    <Group>
                        {/* Outer Border / Glow */}
                        <path
                            d={circuitMetadata.track_path}
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth={18}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.6}
                        />
                        {/* Main Surface */}
                        <path
                            d={circuitMetadata.track_path}
                            fill="none"
                            stroke={
                                currentTrackStatus?.status === "2" ? "#facc15" : // Yellow
                                    currentTrackStatus?.status === "5" ? "#ef4444" : // Red
                                        currentTrackStatus?.status === "4" ? "#94a3b8" : // SC
                                            "#334155" // Normal
                            }
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transition: 'stroke 0.5s ease' }}
                        />
                        {/* Center Inlay Line */}
                        <path
                            d={circuitMetadata.track_path}
                            fill="none"
                            stroke="#0f172a"
                            strokeWidth={10}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.8}
                        />
                    </Group>
                )}

                {/* Overlay Dynamic Segments (If telemetry available) */}
                {segments.length > 0 && segments.map((seg, i) => {
                    let trackBaseColor = "#334155";
                    if (currentTrackStatus?.status === "2") trackBaseColor = "#facc15";
                    else if (currentTrackStatus?.status === "4" || currentTrackStatus?.status === "6") trackBaseColor = "#94a3b8";
                    else if (currentTrackStatus?.status === "5") trackBaseColor = "#ef4444";

                    return (
                        <LinePath
                            key={i}
                            data={seg.points}
                            x={(d: any) => d.x}
                            y={(d: any) => d.y}
                            stroke={trackBaseColor}
                            strokeOpacity={0} // Invisible but kept for consistent hover/interaction
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            curve={curveCardinal}
                        />
                    );
                })}


                {/* Leader Ghost Layer (for comparison) */}
                {(() => {
                    if (!raceData || !leaderAbbr || leaderAbbr === focusedDriver) return null;
                    const leaderFrame = driverFrames[leaderAbbr];
                    if (!leaderFrame) return null;

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
                            <circle
                                r={isFocused ? 10 : 5}
                                fill={pos.color}
                                stroke={isFocused ? "#ffffff" : "none"}
                                strokeWidth={isFocused ? 2 : 0}
                                style={{
                                    filter: isFocused ? 'url(#carGlow)' : 'none',
                                    opacity: isFocused ? 1 : 0.6,
                                    transition: 'r 0.5s ease-out'
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
