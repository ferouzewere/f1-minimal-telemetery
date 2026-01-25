import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrackMap } from './components/TrackMap'
import { Speedometer } from './components/Speedometer'
import { DriverTable } from './components/DriverTable'
import { GlobalMultiGraph } from './components/GlobalMultiGraph'
import { TelemetryHUD } from './components/TelemetryHUD'
import { PlaybackControls } from './components/PlaybackControls'
import { useRaceStore, type DriverData } from './store/useRaceStore'
import { SessionSelector } from './components/SessionSelector'
import { ParentSize } from '@visx/responsive'
import './App.css'

function App() {
  const loadRaceData = useRaceStore(state => state.loadRaceData)
  const raceData = useRaceStore(state => state.raceData)
  const focusedDriver = useRaceStore(state => state.focusedDriver)
  const isPlaying = useRaceStore(state => state.isPlaying)
  const setIsPlaying = useRaceStore(state => state.setIsPlaying)
  const setCurrentTime = useRaceStore(state => state.setCurrentTime)
  const circuitMetadata = useRaceStore(state => state.circuitMetadata)

  const [isNavOpen, setIsNavOpen] = useState(false)

  // Initial Load from Manifest
  useEffect(() => {
    if (!raceData) {
      fetch('/sessions.json')
        .then(res => res.json())
        .then(async (manifest) => {
          const defaultCircuit = manifest.circuits[0];
          const defaultSession = defaultCircuit.sessions[0];
          const res = await fetch(defaultSession.file);
          const data = await res.json();
          loadRaceData(data, {
            id: defaultCircuit.id,
            name: defaultCircuit.name,
            location: defaultCircuit.location,
            lapLength: defaultCircuit.lapLength,
            sectors: defaultCircuit.sectors
          });
        })
        .catch(err => console.error("Initial load failed:", err));
    }
  }, [loadRaceData, raceData]);

  // Calculate Effective Race Duration
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

  // Playback Loop
  useEffect(() => {
    if (!isPlaying || !raceData) return;
    let lastTimestamp = performance.now();
    let frameId: number;
    const loop = (now: number) => {
      const delta = now - lastTimestamp;
      lastTimestamp = now;
      const current = useRaceStore.getState().currentTime;
      const speed = useRaceStore.getState().playSpeed;
      let nextTime = current + (delta * speed);
      if (nextTime >= raceDuration) {
        nextTime = raceDuration;
        setIsPlaying(false);
        setCurrentTime(nextTime);
        return;
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
      <header className={`app-header-hub ${isNavOpen ? 'nav-expanded' : ''}`}>
        <div className="nav-command-center" onClick={() => setIsNavOpen(!isNavOpen)}>
          <div className="hub-identity">
            <h1>{raceData?.race_name || 'F1 MONITOR'}</h1>
            <span className="subtitle">
              {circuitMetadata?.name || 'TRACK MONITOR'}
            </span>
          </div>
          <motion.div
            className="hub-indicator"
            animate={{ rotate: isNavOpen ? 180 : 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </motion.div>
        </div>
        <div className="hub-status-bar">
          <div className={`status-dot ${isPlaying ? 'active' : ''}`} />
          <span className="status-text">{isPlaying ? 'LIVE' : 'PAUSED'}</span>
        </div>
      </header>

      <SessionSelector isOpen={isNavOpen} setIsOpen={setIsNavOpen} />

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
    </div >
  )
}

export default App
