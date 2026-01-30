import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';
import type { DriverData, TelemetryFrame } from '../store/useRaceStore';
import { getSector } from '../utils/constants';
import type { Sector } from '../utils/constants';
import '../styles/DriverTable.css';

interface DriverRow extends DriverData {
    currentFrame: TelemetryFrame;
    pos: number;
    sector: Sector;
    stintNumber: number;
    gap: number;
    sectorProgress: number;
    personalBestLap: number;
    sectorPerformance: Record<number, 'yellow' | 'green' | 'purple'>;
    gapTrend: 'closing' | 'opening' | 'stable';
}

export const DriverTable: React.FC = () => {
    const { raceData, focusedDriver, comparisonDriver, circuitMetadata, setFocusedDriver } = useRaceStore();

    const trackLength = useRaceStore(state => state.trackLength);
    const sessionBestLap = useRaceStore(state => state.sessionBestLap);
    const sessionBests = useRaceStore(state => state.sessionBests);
    const driverFrames = useRaceStore(state => state.driverFrames);
    const leaderAbbr = useRaceStore(state => state.leaderAbbr);

    const driverRows = useMemo<DriverRow[]>(() => {
        if (!raceData || !leaderAbbr) return [];

        const leaderFrame = driverFrames[leaderAbbr];
        if (!leaderFrame) return [];

        const leaderDist = (leaderFrame.lap - 1) * trackLength + leaderFrame.dist;

        // Calculate positions by sorting
        const positions = raceData.drivers
            .map(d => {
                const frame = driverFrames[d.driver_abbr];
                if (!frame) return { abbr: d.driver_abbr, dist: 0 };
                return {
                    abbr: d.driver_abbr,
                    dist: (frame.lap - 1) * trackLength + frame.dist
                };
            })
            .sort((a, b) => b.dist - a.dist);

        return raceData.drivers.map((driver) => {
            const currentFrame = driverFrames[driver.driver_abbr];
            if (!currentFrame) return null;

            const sector = getSector(currentFrame.dist, circuitMetadata);

            // Find current stint based on lap
            const currentStint = driver.stints.find(
                stint => currentFrame.lap >= stint.start_lap &&
                    currentFrame.lap < stint.start_lap + stint.count
            );

            // Calculate Gap (approximate distance gap)
            const myTotalDist = (currentFrame.lap - 1) * trackLength + currentFrame.dist;
            const gap = leaderDist - myTotalDist;

            // Gap Trend (Speed Diff)
            const speedDiff = currentFrame.speed - leaderFrame.speed;
            let gapTrend: 'closing' | 'opening' | 'stable' = 'stable';
            if (speedDiff > 5) gapTrend = 'closing'; // Faster than leader = Catching up
            else if (speedDiff < -5) gapTrend = 'opening'; // Slower than leader = Falling back

            // Sector Progress (0-100%)
            const progress = (currentFrame.dist / trackLength) * 100;
            let sectorProgress = 0;
            if (sector === 1) sectorProgress = (progress / 33) * 100;
            else if (sector === 2) sectorProgress = ((progress - 33) / 33) * 100;
            else sectorProgress = ((progress - 66) / 34) * 100;

            // Find personal best lap
            const pBest = Math.min(...Object.values(driver.lapTimes || {}));

            return {
                ...driver,
                currentFrame,
                pos: positions.findIndex(f => f.abbr === driver.driver_abbr) + 1,
                sector,
                stintNumber: currentStint?.stint || 1,
                gap,
                gapTrend,
                sectorProgress: Math.min(100, Math.max(0, sectorProgress)),
                personalBestLap: pBest,
                sectorPerformance: (() => {
                    const perf: Record<number, 'yellow' | 'green' | 'purple'> = { 1: 'yellow', 2: 'yellow', 3: 'yellow' };
                    // Simplified sector performance for demo
                    return perf;
                })()
            };
        }).filter((driver): driver is DriverRow => driver !== null).sort((a, b) => a.pos - b.pos);
    }, [raceData, driverFrames, leaderAbbr, trackLength, circuitMetadata, sessionBests]);

    if (!raceData) return null;

    return (
        <div className="driver-table-container">
            <div className="table-header-indicator">
                <span>GRID MONITOR</span>
                <div className="live-badge">
                    <div className="ping"></div>
                    LIVE
                </div>
            </div>
            {/* Grid Header */}
            <div className="table-header">
                <div className="th-cell th-pos">#</div>
                <div className="th-cell th-driver">DRIVER</div>
                <div className="th-cell th-tyre">TYRE</div>
                <div className="th-cell th-gap">GAP</div>
                <div className="th-cell th-last">LAST LAP</div>
                <div className="th-cell th-sect">SECTOR</div>
            </div>

            {/* Scrollable Body Grid */}
            <div className="table-scroll-area">
                <AnimatePresence>
                    {driverRows.map((driver) => {
                        const isFocused = focusedDriver === driver.driver_abbr;
                        const { currentFrame, sector, gap, sectorProgress, gapTrend } = driver;
                        const isActive = currentFrame.is_active !== false;

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0 }}
                                animate={{
                                    opacity: focusedDriver ? (isFocused ? 1 : 0.3) : (isActive ? 1 : 0.5),
                                    filter: isActive ? 'none' : 'grayscale(100%)',
                                    zIndex: isFocused ? 50 : 1
                                }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    layout: { type: "spring", stiffness: 200, damping: 25 },
                                    opacity: { duration: 0.2 }
                                }}
                                key={driver.driver_abbr}
                                className={`driver-row ${isFocused ? 'focused' : ''} ${comparisonDriver === driver.driver_abbr ? 'comparing' : ''} ${!isActive ? 'driver-inactive' : ''}`}
                                style={{
                                    borderLeft: `4px solid ${driver.team_color || 'transparent'}`,
                                    background: `linear-gradient(90deg, ${driver.team_color}22 0%, transparent 40%)`
                                }}
                                onClick={(e) => {
                                    if (e.altKey) {
                                        useRaceStore.getState().setComparisonDriver(
                                            comparisonDriver === driver.driver_abbr ? null : driver.driver_abbr
                                        );
                                    } else {
                                        setFocusedDriver(isFocused ? null : driver.driver_abbr);
                                    }
                                }}
                            >
                                <div className="td-cell td-pos">{driver.pos}</div>
                                <div className="td-cell td-driver">
                                    <div className="driver-cell">
                                        <span className="abbr">
                                            {driver.driver_abbr}
                                            {currentFrame.drs === 1 && <span className="drs-badge">DRS</span>}
                                            {currentFrame.is_pit && <span className="pit-badge">PIT</span>}
                                            {!isActive && <span className="dnf-badge" style={{ background: '#ef4444', color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '0.7em', marginLeft: '4px' }}>OUT</span>}
                                        </span>
                                        <span className="team">{driver.team}</span>
                                    </div>
                                </div>
                                <div className="td-cell td-tyre">
                                    <div className="tyre-cell">
                                        <span className={`tyre-dot ${currentFrame.compound?.toLowerCase()}`}></span>
                                        <span className="age">{currentFrame.tyre_age}</span>
                                    </div>
                                </div>
                                <div
                                    className="td-cell td-gap"
                                    style={{
                                        color: gapTrend === 'closing' ? '#4ade80' : (gapTrend === 'opening' ? '#f87171' : 'inherit'),
                                        fontWeight: gapTrend !== 'stable' ? 700 : 400
                                    }}
                                >
                                    {driver.pos === 1 ? 'LEADER' : `+${Math.round((Number(gap) || 0) * 10) / 10}m`}
                                    {gapTrend === 'closing' && <span style={{ fontSize: '0.7em', marginLeft: '4px' }}>▼</span>}
                                    {gapTrend === 'opening' && <span style={{ fontSize: '0.7em', marginLeft: '4px' }}>▲</span>}
                                </div>
                                <div className={`td-cell td-last ${(() => {
                                    const lastLapNum = currentFrame.lap - 1;
                                    const time = driver.lapTimes?.[lastLapNum];
                                    if (!time) return '';
                                    if (time <= sessionBestLap) return 'purple';
                                    if (time <= driver.personalBestLap) return 'green';
                                    return '';
                                })()}`}>
                                    {(() => {
                                        const lastLapNum = currentFrame.lap - 1;
                                        const time = driver.lapTimes?.[lastLapNum];
                                        if (!time) return '---';
                                        const mins = Math.floor(time / 60000);
                                        const secs = ((time % 60000) / 1000).toFixed(3);
                                        return `${mins}:${secs.padStart(6, '0')}`;
                                    })()}
                                </div>
                                <div className="td-cell td-sect">
                                    <div className="sector-progress-container">
                                        <span className={`sector-label s${sector} perf-${driver.sectorPerformance[sector]}`}>S{sector}</span>
                                        <div className="sector-track">
                                            <div
                                                className={`sector-fill s${sector} perf-${driver.sectorPerformance[sector]}`}
                                                style={{ width: `${sectorProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};
