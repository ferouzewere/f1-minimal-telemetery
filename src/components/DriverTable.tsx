import React, { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

export const DriverTable: React.FC = () => {
    const { raceData, currentTime, focusedDriver, setFocusedDriver } = useRaceStore();

    if (!raceData) return null;

    // Pre-calculate frames for all drivers to avoid re-renders or multiple lookups
    const driverRows = useMemo(() => {
        return raceData.drivers.map((driver, idx) => {
            const currentFrame = getInterpolatedFrame(driver.telemetry, currentTime);

            return {
                ...driver,
                currentFrame,
                pos: idx + 1
            };
        });
    }, [raceData, currentTime]);

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
                            <th className="th-speed">SPEED</th>
                            <th className="th-gear">G</th>
                        </tr>
                    </thead>
                    <tbody>
                        {driverRows.map((driver) => {
                            const isFocused = focusedDriver === driver.driver_abbr;
                            const { currentFrame } = driver;

                            return (
                                <tr
                                    key={driver.driver_abbr}
                                    className={`driver-row ${isFocused ? 'focused' : ''}`}
                                    onClick={() => setFocusedDriver(driver.driver_abbr)}
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
                                            <span className={`tyre-dot ${currentFrame.compound?.toLowerCase()}`}>
                                                {currentFrame.compound?.charAt(0)}
                                            </span>
                                            <span className="age">{currentFrame.tyre_age}</span>
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
