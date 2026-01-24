/**
 * Monaco Grand Prix - Real Track Data Visualization
 * Uses authentic 2024 Monaco GP lap data from FastF1
 */

import { useEffect, useMemo } from 'react'
import { TrackMap } from './components/TrackMap'
import { Speedometer } from './components/Speedometer'
import { DriverTable } from './components/DriverTable'
import { useRaceStore } from './store/useRaceStore'
import { getInterpolatedFrame } from './utils/interpolation'
import './App.css'

function App() {
  const {
    currentTime,
    isPlaying,
    raceData,
    focusedDriver,
    loadRaceData,
    setCurrentTime,
    togglePlay,
    seekTo
  } = useRaceStore()

  // Load Full Grid Data
  useEffect(() => {
    fetch('/data/2024_Monaco_full_grid.json')
      .then(res => res.json())
      .then(data => loadRaceData(data))
      .catch(err => console.error("Failed to load race data:", err));
  }, [loadRaceData]);

  // Playback Loop (Smooth rAF)
  useEffect(() => {
    if (!isPlaying || !raceData) return;

    const maxTime = Math.max(...raceData.drivers.map(d =>
      d.telemetry[d.telemetry.length - 1].t
    ));

    let lastTimestamp = performance.now();
    let frameId: number;

    const loop = (now: number) => {
      const delta = now - lastTimestamp;
      lastTimestamp = now;

      const current = useRaceStore.getState().currentTime;
      let nextTime = current + delta;

      if (nextTime > maxTime) {
        nextTime = 0;
      }

      setCurrentTime(nextTime);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, raceData, setCurrentTime]);

  const focusedDriverData = useMemo(() => {
    if (!raceData || !focusedDriver) return null;
    return raceData.drivers.find(d => d.driver_abbr === focusedDriver);
  }, [raceData, focusedDriver]);

  const currentFrame = useMemo(() => {
    if (!focusedDriverData) return null;
    return getInterpolatedFrame(focusedDriverData.telemetry, currentTime);
  }, [focusedDriverData, currentTime]);

  const maxTime = raceData ? Math.max(...raceData.drivers.map(d =>
    d.telemetry[d.telemetry.length - 1].t
  )) : 100;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>{raceData?.race_name || 'F1 Minimal Telemetry'}</h1>
          <span className="subtitle">FULL GRID MONITOR • MONACO 2024</span>
        </div>
        <div className="status">
          <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
          <div className={`dot ${isPlaying ? 'active' : ''}`}></div>
        </div>
      </header>

      <main className="app-main">
        <div className="track-section">
          <div className="viz-card track-card">
            <TrackMap width={900} height={600} />
          </div>

          <div className="telemetry-bar">
            {focusedDriverData && (
              <>
                <div className="telemetry-item">
                  <span className="label">FOCUS: {focusedDriverData.driver_abbr}</span>
                  <span className="value gear">{currentFrame?.gear || '-'}</span>
                </div>
                <div className="telemetry-item">
                  <span className="label">THROTTLE</span>
                  <div className="bar-bg">
                    <div className="bar-fill throttle" style={{ width: `${currentFrame?.throttle || 0}%` }}></div>
                  </div>
                </div>
                <div className="telemetry-item">
                  <span className="label">BRAKE</span>
                  <div className="bar-bg">
                    <div className="bar-fill brake" style={{ width: `${currentFrame?.brake || 0}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="side-panel">
          <DriverTable />

          <div className="viz-card speed-card">
            <Speedometer width={250} height={250} />
          </div>

          <div className="controls-card">
            <button
              className={`play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
            >
              {isPlaying ? 'STOP' : 'START REPLAY'}
            </button>

            <div className="scrubber-container">
              <div className="scrubber-timer-box">
                <span className="lap-counter">LAP {currentFrame?.lap || 1}</span>
                <div className="timer">
                  {(currentTime / 1000).toFixed(3)}s
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={maxTime}
                value={currentTime}
                onChange={(e) => seekTo(parseInt(e.target.value))}
                className="scrubber"
              />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
