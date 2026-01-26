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
                sectorProgress: Math.min(100, Math.max(0, sectorProgress)),
                personalBestLap: pBest,
                sectorPerformance: (() => {
                    const perf: Record<number, 'yellow' | 'green' | 'purple'> = { 1: 'yellow', 2: 'yellow', 3: 'yellow' };
                    if (!driver.sectorTimes || !driver.sectorTimes[currentFrame.lap]) {
                        // Check previous lap if current lap sectors aren't done
                        const prevLap = currentFrame.lap - 1;
                        if (driver.sectorTimes?.[prevLap]) {
                            // This logic could be more complex, but let's stick to last completed for now
                        }
                    }

                    // Helper to get color for a sector value
                    const getColor = (s: 's1' | 's2' | 's3', time: number) => {
                        if (!time || time === Infinity) return 'yellow';
                        if (time <= sessionBests[s]) return 'purple';
                        if (time <= driver.personalBests[s]) return 'green';
                        return 'yellow';
                    };

                    const currentSectors = driver.sectorTimes?.[currentFrame.lap] || { s1: 0, s2: 0, s3: 0 };
                    if (currentSectors.s1) perf[1] = getColor('s1', currentSectors.s1);
                    if (currentSectors.s2) perf[2] = getColor('s2', currentSectors.s2);
                    // For S3, it's only known at the end of the lap, usually.

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
            {/* Static Header Table */}
            <table className="driver-table">
                <thead>
                    <tr>
                        <th className="th-pos">#</th>
                        <th className="th-driver">DRIVER</th>
                        <th className="th-tyre">TYRE</th>
                        <th className="th-gap">GAP</th>
                        <th className="th-last">LAST LAP</th>
                        <th className="th-sect">SECTOR</th>
                    </tr>
                </thead>
            </table>

            {/* Scrollable Body Table */}
            <div className="table-scroll-area">
                <table className="driver-table">
                    <tbody className={focusedDriver ? 'has-focus' : ''}>
                        <AnimatePresence>
                            {driverRows.map((driver) => {
                                const isFocused = focusedDriver === driver.driver_abbr;
                                const { currentFrame, sector, gap, sectorProgress } = driver;

                                return (
                                    <motion.tr
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{
                                            opacity: focusedDriver ? (isFocused ? 1 : 0.3) : 1,
                                            zIndex: isFocused ? 50 : 1
                                        }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                            layout: { type: "spring", stiffness: 200, damping: 25 },
                                            opacity: { duration: 0.2 }
                                        }}
                                        key={driver.driver_abbr}
                                        className={`driver-row ${isFocused ? 'focused' : ''} ${comparisonDriver === driver.driver_abbr ? 'comparing' : ''}`}
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
                                        <td className="td-pos">{driver.pos}</td>
                                        <td className="td-driver">
                                            <div className="driver-cell">
                                                <span className="abbr">
                                                    {driver.driver_abbr}
                                                    {currentFrame.drs === 1 && <span className="drs-badge">DRS</span>}
                                                    {currentFrame.is_pit && <span className="pit-badge">PIT</span>}
                                                </span>
                                                <span className="team">{driver.team}</span>
                                            </div>
                                        </td>
                                        <td className="td-tyre">
                                            <div className="tyre-cell">
                                                <span className={`tyre-dot ${currentFrame.compound?.toLowerCase()}`}></span>
                                                <span className="age">{currentFrame.tyre_age}</span>
                                            </div>
                                        </td>
                                        <td className="td-gap">
                                            {driver.pos === 1 ? 'LEADER' : `+${Math.round((Number(gap) || 0) * 10) / 10}m`}
                                        </td>
                                        <td className={`td-last ${(() => {
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
                                        </td>
                                        <td className="td-sect">
                                            <div className="sector-progress-container">
                                                <span className={`sector-label s${sector} perf-${driver.sectorPerformance[sector]}`}>S{sector}</span>
                                                <div className="sector-track">
                                                    <div
                                                        className={`sector-fill s${sector} perf-${driver.sectorPerformance[sector]}`}
                                                        style={{ width: `${sectorProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
