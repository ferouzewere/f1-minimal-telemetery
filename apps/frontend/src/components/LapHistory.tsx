import React, { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import '../styles/LapHistory.css';

export const LapHistory: React.FC = () => {
    const { raceData, focusedDriver } = useRaceStore();

    const focusedDriverData = useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
    }, [raceData, focusedDriver]);

    if (!focusedDriverData || !focusedDriverData.lapTimes) return null;

    const lapNumbers = Object.keys(focusedDriverData.lapTimes)
        .map(Number)
        .sort((a, b) => b - a); // Newest first

    if (lapNumbers.length === 0) return null;

    const formatLapTime = (time: number) => {
        const mins = Math.floor(time / 60000);
        const secs = ((time % 60000) / 1000).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    return (
        <div className="lap-history-container">
            <div className="history-header">
                <span className="history-label">LAP PERFORMANCE HISTORY</span>
            </div>
            <div className="history-scroll-area">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>LAP</th>
                            <th>TIME</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lapNumbers.map(lapNum => (
                            <tr key={lapNum}>
                                <td className="td-lap-num">L{lapNum}</td>
                                <td className="td-lap-time">{formatLapTime(focusedDriverData.lapTimes[lapNum])}</td>
                                <td className="td-lap-status">
                                    <span className="status-badge valid">VALID</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
