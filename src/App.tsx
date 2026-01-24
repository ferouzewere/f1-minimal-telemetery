/**
 * Monaco Grand Prix - Real Track Data Visualization
 * Uses authentic 2024 Monaco GP lap data from FastF1
 */

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrackMap } from './components/TrackMap'
import { Speedometer } from './components/Speedometer'
import { DriverTable } from './components/DriverTable'
import { GlobalMultiGraph } from './components/GlobalMultiGraph'
import { TelemetryHUD } from './components/TelemetryHUD'
import { PlaybackControls } from './components/PlaybackControls'
import { useRaceStore, type DriverData } from './store/useRaceStore'
import { ParentSize } from '@visx/responsive'
import './App.css'

function App() {
  // Select ONLY static/low-frequency state for the root component
  const loadRaceData = useRaceStore(state => state.loadRaceData)
  const raceData = useRaceStore(state => state.raceData)
  const focusedDriver = useRaceStore(state => state.focusedDriver)
  const isPlaying = useRaceStore(state => state.isPlaying)
  const setIsPlaying = useRaceStore(state => state.setIsPlaying)
  const setCurrentTime = useRaceStore(state => state.setCurrentTime)

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const availableCircuits = [
    { id: 'monaco', name: 'Monaco Grand Prix', year: 2024, file: '/data/2024_Monaco_phase2.json' },
    { id: 'silverstone', name: 'British Grand Prix (Coming Soon)', year: 2024, disabled: true },
    { id: 'spa', name: 'Belgian Grand Prix (Coming Soon)', year: 2024, disabled: true },
  ];

  // Load Phase 2 Data (Multi-Lap Support)
  useEffect(() => {
    fetch('/data/2024_Monaco_phase2.json')
      .then(res => res.json())
      .then(data => loadRaceData(data))
      .catch(err => console.error("Failed to load race data:", err));
  }, [loadRaceData]);

  // Close selector when clicking outside
  useEffect(() => {
    const handleDown = () => setIsSelectorOpen(false);
    if (isSelectorOpen) {
      window.addEventListener('mousedown', handleDown);
    }
    return () => window.removeEventListener('mousedown', handleDown);
  }, [isSelectorOpen]);

  // Calculate Effective Race Duration (Total duration in data)
  const raceDuration = useMemo(() => {
    if (!raceData) return 0;

    let maxT = 0;
    raceData.drivers.forEach((driver: DriverData) => {
      const lastFrame = driver.telemetry[driver.telemetry.length - 1];
      if (lastFrame && lastFrame.t > maxT) {
        maxT = lastFrame.t;
      }
    });

    return maxT;
  }, [raceData]);

  // Playback Loop (Smooth rAF)
  useEffect(() => {
    if (!isPlaying || !raceData) return;

    let lastTimestamp = performance.now();
    let frameId: number;

    const loop = (now: number) => {
      const delta = now - lastTimestamp;
      lastTimestamp = now;

      const current = useRaceStore.getState().currentTime;
      let nextTime = current + delta;

      if (nextTime >= raceDuration) {
        nextTime = raceDuration;
        setIsPlaying(false); // Stop at end
        setCurrentTime(nextTime);
        return; // Exit loop
      }

      setCurrentTime(nextTime);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, raceData, setCurrentTime, raceDuration, setIsPlaying]);

  const hasFocus = !!focusedDriver;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-spacer"></div>
        <div
          className={`header-center race-selector ${isSelectorOpen ? 'open' : ''}`}
          title="Select Circuit"
          onClick={() => setIsSelectorOpen(!isSelectorOpen)}
        >
          <div className="race-selector-border-v left"></div>
          <div className="race-selector-border-v right"></div>
          <div className="header-info">
            <h1>{raceData?.race_name || 'F1 Minimal Telemetry'}</h1>
            <span className="subtitle">FULL GRID MONITOR • MONACO 2024</span>
          </div>
          <svg className="selector-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>

          {isSelectorOpen && (
            <div className="race-dropdown">
              <div className="dropdown-header">AVAILABLE SESSIONS</div>
              {availableCircuits.map((c) => (
                <div
                  key={c.id}
                  className={`dropdown-item ${c.disabled ? 'disabled' : ''} ${c.name === raceData?.race_name ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c.disabled || !c.file) return;
                    fetch(c.file)
                      .then(res => res.json())
                      .then(data => loadRaceData(data))
                      .finally(() => setIsSelectorOpen(false));
                  }}
                >
                  <div className="item-main">
                    <span className="year">{c.year}</span>
                    <span className="name">{c.name}</span>
                  </div>
                  {c.disabled && <span className="status-tag">UPCOMING</span>}
                  {c.name === raceData?.race_name && <div className="active-dot"></div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="status">
          <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
          <div className={`dot ${isPlaying ? 'active' : ''}`}></div>
        </div>
      </header>

      <main className="app-main">
        <div className="track-section">
          <div className="viz-card track-card">
            <ParentSize>
              {({ width, height }) => <TrackMap width={width} height={height} />}
            </ParentSize>
          </div>

          <div className="unified-intelligence-panel">
            <AnimatePresence mode="wait">
              {hasFocus ? (
                <motion.div
                  key="focus"
                  className="focus-intelligence-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <TelemetryHUD />
                </motion.div>
              ) : (
                <motion.div
                  key="global"
                  className="global-intelligence-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ParentSize>
                    {({ width, height }) => <GlobalMultiGraph width={width} height={height} />}
                  </ParentSize>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className="side-panel">
          <DriverTable />

          <div className="viz-card speed-card">
            <Speedometer width={250} height={250} />
          </div>

          <PlaybackControls />
        </aside>
      </main>
    </div>
  )
}

export default App
