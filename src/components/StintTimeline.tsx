import { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import '../styles/StintTimeline.css';

export const StintTimeline = () => {
    const { raceData, focusedDriver } = useRaceStore();

    const focusedDriverData = useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
    }, [raceData, focusedDriver]);

    if (!focusedDriverData || !focusedDriverData.stints) return null;

    const COMPOUND_COLORS: Record<string, string> = {
        'SOFT': '#ff0000',
        'MEDIUM': '#ffeb00',
        'HARD': '#ffffff',
        'INTERMEDIATE': '#00ff00',
        'WET': '#0000ff',
    };

    return (
        <div className="stint-timeline">
            <div className="timeline-header">
                <span className="driver-name">{focusedDriverData.driver_abbr}</span>
                <span className="timeline-label">TYRE STRATEGY</span>
            </div>
            <div className="timeline-track">
                {focusedDriverData.stints.map((stint, idx) => {
                    const color = COMPOUND_COLORS[stint.compound] || '#888';
                    const width = `${(stint.count / focusedDriverData.stints.reduce((sum, s) => sum + s.count, 0)) * 100}%`;

                    return (
                        <div
                            key={idx}
                            className="stint-block"
                            style={{
                                width,
                                backgroundColor: color,
                                opacity: 0.8
                            }}
                            title={`${stint.compound}: Laps ${stint.start_lap} - ${stint.start_lap + stint.count - 1} (${stint.count} laps)`}
                        >
                            <span className="stint-label">{stint.compound[0]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
