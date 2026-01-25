import React, { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';
import { getSector } from '../utils/constants';

export const DriverTable: React.FC = () => {
    const { raceData, currentTime, focusedDriver, comparisonDriver, circuitMetadata, setFocusedDriver } = useRaceStore();

    const trackLength = useRaceStore(state => state.trackLength);
    const sessionBestLap = useRaceStore(state => state.sessionBestLap);

    const driverRows = useMemo(() => {
        if (!raceData) return [];

        // Initial pass to get all frames
        const frames = raceData.drivers.map(d => ({
            abbr: d.driver_abbr,
            frame: getInterpolatedFrame(d.telemetry, currentTime)
        }));

        // Sort by total distance traveled (lap * trackLength + dist) to find true leader
        const sortedFrames = [...frames].sort((a, b) => {
            const distA = (a.frame.lap - 1) * trackLength + a.frame.dist;
            const distB = (b.frame.lap - 1) * trackLength + b.frame.dist;
            return distB - distA;
        });

        const leaderDist = (sortedFrames[0].frame.lap - 1) * trackLength + sortedFrames[0].frame.dist;

        return raceData.drivers.map((driver) => {
            const currentFrame = getInterpolatedFrame(driver.telemetry, currentTime);
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
                pos: sortedFrames.findIndex(f => f.abbr === driver.driver_abbr) + 1,
                sector,
                stintNumber: currentStint?.stint || 1,
                gap,
                sectorProgress: Math.min(100, Math.max(0, sectorProgress)),
                personalBestLap: pBest
            };
        }).sort((a, b) => a.pos - b.pos);
    }, [raceData, currentTime, trackLength, circuitMetadata]);

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
            <div className="table-scroll-area">
                <table className="driver-table">
                    <thead>
                        <tr>
                            <th className="th-pos">#</th>
                            <th className="th-driver">DRIVER</th>
                            <th className="th-tyre">TYRE</th>
                            <th className="th-stint">ST</th>
                            <th className="th-gap">GAP</th>
                            <th className="th-last">LAST LAP</th>
                            <th className="th-sect">SECTOR</th>
                            <th className="th-speed">SPEED</th>
                            <th className="th-gear">G</th>
                        </tr>
                    </thead>
                    <tbody>
                        {driverRows.map((driver) => {
                            const isFocused = focusedDriver === driver.driver_abbr;
                            const { currentFrame, sector, stintNumber, gap, sectorProgress } = driver;

                            return (
                                <tr
                                    key={driver.driver_abbr}
                                    className={`driver-row ${isFocused ? 'focused' : ''} ${comparisonDriver === driver.driver_abbr ? 'comparing' : ''}`}
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
                                            <span className="abbr">{driver.driver_abbr}</span>
                                            <span className="team">{driver.team}</span>
                                        </div>
                                    </td>
                                    <td className="td-tyre">
                                        <div className="tyre-cell">
                                            <span className={`tyre-dot ${currentFrame.compound?.toLowerCase()}`}></span>
                                            <span className="age">{currentFrame.tyre_age}</span>
                                        </div>
                                    </td>
                                    <td className="td-stint">
                                        <span className="stint-number">{stintNumber}</span>
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
                                            <span className={`sector-label s${sector}`}>S{sector}</span>
                                            <div className="sector-track">
                                                <div
                                                    className={`sector-fill s${sector}`}
                                                    style={{ width: `${sectorProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="td-speed">{currentFrame.speed}</td>
                                    <td className="td-gear">{currentFrame.gear}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
