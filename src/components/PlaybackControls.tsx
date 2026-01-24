import React from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

export const PlaybackControls: React.FC = () => {
    const {
        currentTime,
        isPlaying,
        raceData,
        focusedDriver,
        totalLaps,
        pitStops,
        togglePlay,
        seekTo
    } = useRaceStore();

    const focusedDriverData = React.useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
    }, [raceData, focusedDriver]);

    const currentFrame = React.useMemo(() => {
        if (!focusedDriverData) return null;
        return getInterpolatedFrame(focusedDriverData.telemetry, currentTime);
    }, [focusedDriverData, currentTime]);

    const maxTime = React.useMemo(() => {
        if (!raceData) return 100;
        return Math.max(...raceData.drivers.map(d =>
            d.telemetry[d.telemetry.length - 1].t
        ));
    }, [raceData]);

    return (
        <div className="controls-card">
            <button
                className={`play-btn ${isPlaying ? 'playing' : ''}`}
                onClick={togglePlay}
            >
                {isPlaying ? 'STOP' : 'START REPLAY'}
            </button>

            <div className="scrubber-container">
                <div className="scrubber-timer-box">
                    <span className="lap-counter">
                        LAP {currentFrame?.lap || 1} / {totalLaps}
                    </span>
                    <div className="timer">
                        {(Number(currentTime) / 1000 || 0).toFixed(3)}s
                    </div>
                </div>
                <div style={{ position: 'relative', width: '100%' }}>
                    <input
                        type="range"
                        min="0"
                        max={maxTime}
                        value={currentTime}
                        onChange={(e) => seekTo(parseInt(e.target.value))}
                        className="scrubber"
                    />
                    {/* Pit Stop Markers */}
                    {pitStops.map((pit, idx) => {
                        const position = (pit.timestamp / maxTime) * 100;
                        return (
                            <div
                                key={`${pit.driver_abbr}-${idx}`}
                                className="pit-marker"
                                style={{
                                    position: 'absolute',
                                    left: `${position}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '3px',
                                    height: '20px',
                                    backgroundColor: '#facc15',
                                    pointerEvents: 'none',
                                    zIndex: 1
                                }}
                                title={`${pit.driver_abbr} - Lap ${pit.lap}`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
