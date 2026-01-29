import React, { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    return `${minutes}:${seconds.padStart(4, '0')}`;
};

interface PlaybackControlsProps {
    isVertical?: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ isVertical = false }) => {
    const {
        currentTime,
        isPlaying,
        playSpeed,
        raceData,
        focusedDriver,
        totalLaps,
        togglePlay,
        seekTo,
        setPlaySpeed,
        isLive,
        isHistorical
    } = useRaceStore();

    React.useEffect(() => {
        console.log('[PlaybackControls] State update:', {
            isPlaying,
            isLive,
            isHistorical,
            currentTime
        });
    }, [isPlaying, isLive, isHistorical, currentTime]);

    const focusedDriverData = useMemo(() => {
        if (!raceData || !focusedDriver) return null;
        return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
    }, [raceData, focusedDriver]);

    const currentFrame = useMemo(() => {
        if (!focusedDriverData) return null;
        try {
            return getInterpolatedFrame(focusedDriverData.telemetry, currentTime).frame;
        } catch (e) {
            return null;
        }
    }, [focusedDriverData, currentTime]);

    const { minTime, maxTime } = useMemo(() => {
        if (!raceData || raceData.drivers.length === 0) return { minTime: 0, maxTime: 100 };
        const allStarts = raceData.drivers.flatMap(d => d.telemetry.length > 0 ? [d.telemetry[0].t] : []);
        const allEnds = raceData.drivers.flatMap(d => d.telemetry.length > 0 ? [d.telemetry[d.telemetry.length - 1].t] : []);

        if (allStarts.length === 0) return { minTime: 0, maxTime: 100 };

        return {
            minTime: Math.min(...allStarts),
            maxTime: Math.max(...allEnds)
        };
    }, [raceData]);

    const relativeTime = Math.max(0, currentTime - minTime);
    const completion = maxTime > minTime ? ((currentTime - minTime) / (maxTime - minTime)) * 100 : 0;

    return (
        <div className={`minimal-playback-pill ${isVertical ? 'vertical' : ''}`}>
            {!isVertical && (
                <>
                    <div className="pill-section actions">
                        <button className="pill-btn restart" onClick={() => seekTo(minTime)} title="Restart">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                            </svg>
                        </button>
                        <button className={`pill-btn play ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
                            {isPlaying ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                                </svg>
                            ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="pill-section stats">
                        {isLive && !isHistorical && (
                            <div className="status-badge live">
                                <span className="pulse"></span> LIVE
                            </div>
                        )}
                        <span className="pill-lap">L{currentFrame?.lap || 1}/{totalLaps || '-'}</span>
                        <span className="pill-time">{formatTime(relativeTime)}</span>
                    </div>
                </>
            )}

            <div className="pill-section progress">
                <div className="pill-progress-track">
                    <div className="pill-progress-fill" style={{ [isVertical ? 'height' : 'width']: `${completion}%`, [isVertical ? 'width' : 'height']: '100%' }} />
                </div>
                <input
                    type={isVertical ? "range" : "range"}
                    style={isVertical ? { writingMode: 'bt-lr', appearance: 'slider-vertical', width: '4px', height: '120px' } as any : {}}
                    min={minTime}
                    max={maxTime}
                    value={currentTime}
                    onChange={(e) => seekTo(parseInt(e.target.value))}
                    className="pill-scrubber"
                />
            </div>

            <div className="pill-section speeds">
                {[1, 2, 5].map(speed => (
                    <button
                        key={speed}
                        className={`pill-speed ${playSpeed === speed ? 'active' : ''}`}
                        onClick={() => setPlaySpeed(speed)}
                    >
                        {speed}x
                    </button>
                ))}
            </div>

            {isVertical && (
                <div className="pill-section actions">
                    <button className="pill-btn restart" onClick={() => seekTo(minTime)} title="Restart">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                        </svg>
                    </button>
                    <button className={`pill-btn play main-mobile-play ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
                        {isPlaying ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
