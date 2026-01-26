import { useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ParentSize } from '@visx/responsive'

import { TrackMap } from './components/TrackMap'
import { Speedometer } from './components/Speedometer'
import { DriverTable } from './components/DriverTable'

import { SpeedDistanceGraph } from './components/SpeedDistanceGraph'
import { GlobalMultiGraph } from './components/GlobalMultiGraph'

import { PlaybackControls } from './components/PlaybackControls'
import { SessionSelector } from './components/SessionSelector'
import { Compass } from './components/Compass'
import { VehicleStatus } from './components/VehicleStatus'
import { getInterpolatedFrame } from './utils/interpolation'

import { useRaceStore, type DriverData } from './store/useRaceStore'
import './styles/Copyright.css'
import './App.css'

function App() {
  const loadRaceData = useRaceStore(state => state.loadRaceData)
  const raceData = useRaceStore(state => state.raceData)
  const focusedDriver = useRaceStore(state => state.focusedDriver)
  const isPlaying = useRaceStore(state => state.isPlaying)
  const setIsPlaying = useRaceStore(state => state.setIsPlaying)
  const setCurrentTime = useRaceStore(state => state.setCurrentTime)
  const currentTime = useRaceStore(state => state.currentTime)
  const totalLaps = useRaceStore(state => state.totalLaps)
  const circuitMetadata = useRaceStore(state => state.circuitMetadata)

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = windowWidth <= 640
  // Initial state based on focus
  const [activeHudSlide, setActiveHudSlide] = useState<'gauges' | 'pulse'>(focusedDriver ? 'gauges' : 'pulse')

  // Sync Carousel with Focus Mode Transitions
  const lastFocusRef = useRef(!!focusedDriver);
  useEffect(() => {
    const hasFocusNow = !!focusedDriver;
    if (hasFocusNow !== lastFocusRef.current) {
      setActiveHudSlide(hasFocusNow ? 'gauges' : 'pulse');
      lastFocusRef.current = hasFocusNow;
    }
  }, [focusedDriver]);

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
    <div className="cockpit-view">
      {/* LAYER 0: Full Screen Ambient Map */}
      <div className="track-background-layer">
        <ParentSize>
          {({ width, height }) => <TrackMap width={width} height={height} verticalOffset={isMobile ? 120 : 0} />}
        </ParentSize>
      </div>

      {/* LAYER 1: HUD Grid Overlay */}
      <div className="hud-overlay-layer">

        {/* Top Center: Mission Control Header (Redesigned Pill) */}
        <header className="hud-panel hud-top-center-pill">
          <div className="hub-capsule transparent-pill" onClick={() => setIsNavOpen(!isNavOpen)}>
            <div className="hub-title">
              <h1>{raceData?.race_name || 'F1 MONITOR'}</h1>
              <span>{circuitMetadata?.name || 'TRACK MONITOR'}</span>
            </div>

            <motion.div
              animate={{ rotate: isNavOpen ? 180 : 0 }}
              style={{ color: '#64748b' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </motion.div>
          </div>
        </header>

        {/* Top Right: Leaderboard */}
        <aside className="hud-panel hud-top-right">
          <DriverTable />
        </aside>

        {/* Mobile Carousel HUD (Visible only on mobile) */}
        {isMobile && (
          <>
            <div className={`hud-panel hud-bottom-right hud-carousel-container ${!hasFocus ? 'inactive' : ''}`}>
              {/* SIDE ARROWS (Visible only in focused mode) */}
              {hasFocus && (
                <>
                  <button
                    className="carousel-arrow left"
                    onClick={() => setActiveHudSlide(activeHudSlide === 'gauges' ? 'pulse' : 'gauges')}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>

                  <button
                    className="carousel-arrow right"
                    onClick={() => setActiveHudSlide(activeHudSlide === 'pulse' ? 'gauges' : 'pulse')}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </>
              )}

              <AnimatePresence mode="wait">
                {activeHudSlide === 'gauges' ? (
                  <motion.div
                    key="gauges"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: hasFocus ? 1 : 0.01, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`speed-cluster ${!hasFocus ? 'inactive' : 'focused'}`}
                    style={{ background: 'transparent' }}
                  >
                    <div className="cluster-side left">
                      <Compass size={70} />
                    </div>
                    <div className="cluster-center">
                      <Speedometer width={180} height={180} />
                    </div>
                    <div className="cluster-side right">
                      <VehicleStatus size={70} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pulse"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="pulse-carousel-slide"
                    style={{ width: '100%', height: '200px' }}
                  >
                    <ParentSize>
                      {({ width, height }) => (
                        focusedDriver ?
                          <SpeedDistanceGraph width={width} height={height} /> :
                          <GlobalMultiGraph width={width} height={height} />
                      )}
                    </ParentSize>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* VERTICAL RIGHT-SIDE CONTROLS (MOBILE ONLY) */}
            <div className="hud-right-controls">
              <div className="race-status-clock mobile-stack-clock">
                <span className="lap-indicator">L{raceData?.drivers[0] ? getInterpolatedFrame(raceData.drivers[0].telemetry, currentTime).lap : 1}/{totalLaps || '-'}</span>
                <span className="time-separator">/</span>
                <span className="elapsed-time">{
                  (() => {
                    const totalSeconds = currentTime / 1000;
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = (totalSeconds % 60).toFixed(1);
                    return `${minutes}:${seconds.padStart(4, '0')}`;
                  })()
                }</span>
              </div>
              <PlaybackControls isVertical />
            </div>
          </>
        )}

        {/* Desktop/Tablet HUD (Hidden on mobile) */}
        {!isMobile && (
          <>
            {/* Middle Left: Pulse Chart Only */}
            <div className="hud-panel hud-bottom-left">
              <div className="telemetry-hud-container">
                <AnimatePresence mode="wait">
                  {hasFocus ? (
                    <motion.div
                      key="focus"
                      className="focus-intelligence-view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ParentSize>
                        {({ width, height }) => <SpeedDistanceGraph width={width} height={height} />}
                      </ParentSize>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="global"
                      className="global-intelligence-view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ParentSize>
                        {({ width, height }) => <GlobalMultiGraph width={width} height={height} />}
                      </ParentSize>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Right: Speed Cluster */}
            <div className={`hud-panel hud-bottom-right ${!hasFocus ? 'inactive' : ''}`}>
              <div className={`speed-cluster ${!hasFocus ? 'inactive' : 'focused'}`}>
                <div className="cluster-side left">
                  <Compass size={108} />
                </div>
                <div className="cluster-center">
                  <Speedometer width={280} height={280} />
                </div>
                <div className="cluster-side right">
                  <VehicleStatus size={108} />
                </div>
              </div>
            </div>

            {/* Bottom Center: Minimal Controls Pill */}
            <div className="hud-panel hud-bottom-center">
              <PlaybackControls />
            </div>
          </>
        )}

        {/* Copyright Footer */}
        <div className="copyright-footer">
          DEVELOPED BY FEROUZE
        </div>

        <SessionSelector isOpen={isNavOpen} setIsOpen={setIsNavOpen} />
      </div>
    </div>
  )
}

export default App
