import { useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ParentSize } from '@visx/responsive'

import { TrackMap } from './components/TrackMap'
import { BackgroundJobIndicator } from './components/BackgroundJobIndicator';
import { Speedometer } from './components/Speedometer'
import { DriverTable } from './components/DriverTable'

import { SpeedDistanceGraph } from './components/SpeedDistanceGraph'
import { GlobalMultiGraph } from './components/GlobalMultiGraph'

import { PlaybackControls } from './components/PlaybackControls'
import { SessionSelector } from './components/SessionSelector'
import { Compass } from './components/Compass'
import { VehicleStatus } from './components/VehicleStatus'
import { getCachedData } from './utils/db'
import { WeatherOverlay } from './components/WeatherOverlay'
import { TrackStatusBanner } from './components/TrackStatusBanner'
import { IntegratedGauge } from './components/IntegratedGauge'
import { RaceFxOverlay } from './components/RaceFxOverlay'

import { getFlagUrl } from './utils/countryMapping'
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

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input (though we don't have many inputs)
      if (document.activeElement instanceof HTMLInputElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          useRaceStore.getState().togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          useRaceStore.getState().setCurrentTime(Math.max(0, useRaceStore.getState().currentTime - 5000));
          break;
        case 'ArrowRight':
          e.preventDefault();
          const maxTime = useRaceStore.getState().raceData?.drivers.reduce((max, d) => Math.max(max, d.telemetry[d.telemetry.length - 1]?.t || 0), 0) || 0;
          useRaceStore.getState().setCurrentTime(Math.min(maxTime, useRaceStore.getState().currentTime + 5000));
          break;
        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            }
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    }
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

  // Initial Load from Manifest with Caching
  useEffect(() => {
    if (!raceData) {
      const loadInitialData = async () => {
        try {
          // 1. Initial Fetch for manifest (needed regardless)
          const manifestRes = await fetch('/sessions.json');
          const manifest = await manifestRes.json();
          const defaultCircuit = manifest.circuits[0];
          const defaultSession = defaultCircuit.sessions[0];
          const cacheKey = `race_${defaultSession.id}`;

          // 2. Try Cache First
          const cached = await getCachedData(cacheKey);
          if (cached) {
            console.log("Loading from cache:", cacheKey);
            // Load race data but overwrite metadata since we just fetched manifest
            loadRaceData(cached.raceData, {
              id: defaultCircuit.id,
              name: defaultCircuit.name,
              location: defaultCircuit.location,
              lapLength: defaultCircuit.lapLength,
              sectors: defaultCircuit.sectors
            });
            return;
          }

          // 3. Fallback if no cache
          const sessionRes = await fetch(defaultSession.file);
          const data = await sessionRes.json();

          loadRaceData(data, {
            id: defaultCircuit.id,
            name: defaultCircuit.name,
            location: defaultCircuit.location,
            lapLength: defaultCircuit.lapLength,
            sectors: defaultCircuit.sectors
          }, cacheKey);
        } catch (err) {
          console.error("Initial load failed:", err);
        }
      };
      loadInitialData();
    }
  }, [loadRaceData, raceData]);

  // Bridge Status Heartbeat
  const setBridgeStatus = useRaceStore(state => state.setBridgeStatus);
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch('http://localhost:3001/status');
        setBridgeStatus(res.ok ? 'online' : 'offline');
      } catch {
        setBridgeStatus('offline');
      }
    };

    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, [setBridgeStatus]);

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
    <div className={`cockpit-view ${hasFocus ? 'is-focused-tracking' : ''}`}>
      {/* GLOBAL FOCUS OVERLAY */}
      <motion.div
        className="focus-vignette"
        initial={{ opacity: 0 }}
        animate={{ opacity: hasFocus ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />

      {/* LAYER 0: Full Screen Ambient Map */}
      <div className="track-background-layer">
        <ParentSize>
          {({ width, height }) => <TrackMap width={width} height={height} verticalOffset={isMobile ? 120 : 0} />}
        </ParentSize>
      </div>

      {/* LAYER 0.5: Global Weather Effects */}
      <WeatherOverlay />

      {/* LAYER 1: HUD Grid Overlay */}
      <div className="hud-overlay-layer">
        {/* Cinematic FX Overlays */}
        <RaceFxOverlay />

        {/* Top Center: Mission Control Header (Redesigned Pill) */}
        <header className="hud-panel hud-top-center-pill">
          <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'auto' }}>
            <div
              className="hub-capsule transparent-pill"
              onClick={() => setIsNavOpen(!isNavOpen)}
              style={{ position: 'relative', zIndex: 200 }} // Higher than indicator
            >
              {circuitMetadata?.location && (
                <div className="header-flag-container">
                  <img
                    src={getFlagUrl(circuitMetadata.location) || ''}
                    alt="Flag"
                    className="header-flag"
                  />
                </div>
              )}
              <div className="hub-title">
                <h1>{raceData?.race_name || 'F1 MONITOR'}</h1>
                <div className="hub-subtitle">
                  <span>{circuitMetadata?.name || 'TRACK MONITOR'}</span>
                  {circuitMetadata?.lapLength && (
                    <span className="circuit-specs">
                      • {(circuitMetadata.lapLength / 1000).toFixed(3)} KM • {totalLaps || '-'} LAPS
                    </span>
                  )}
                </div>
              </div>
              <div
                className="pill-action"
                style={{
                  marginLeft: '0.5rem',
                  transform: isNavOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  color: '#64748b'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            <BackgroundJobIndicator />
          </div>
        </header>

        {/* Top Left: Track Status & Weather */}
        <div className="hud-panel hud-top-left" style={{ top: '7.5rem' }}>
          <TrackStatusBanner />
        </div>

        {/* Top Right: Leaderboard */}
        <aside className={`hud-panel hud-top-right ${hasFocus ? 'highlight-section' : ''}`}>
          <DriverTable />
        </aside>

        {/* Mobile Carousel HUD (Visible only on mobile) */}
        {isMobile && (
          <>
            <div className="hud-panel hud-bottom-right hud-carousel-container">
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: hasFocus ? 1 : 0.01, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`speed-cluster ${!hasFocus ? 'inactive' : 'focused'}`}
                    style={{
                      background: 'transparent',
                      justifyContent: 'center',
                      width: '100%',
                      height: '300px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <IntegratedGauge size={240} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="pulse"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="pulse-carousel-slide"
                    style={{ width: '100%', height: '300px', display: 'flex', alignItems: 'center' }}
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
                <span className="lap-indicator">L{raceData?.drivers[0] && useRaceStore.getState().driverFrames[raceData.drivers[0].driver_abbr]?.lap || 1}/{totalLaps || '-'}</span>
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
            <div className="hud-panel hud-bottom-left highlight-section">
              <div className="telemetry-hud-container">
                <AnimatePresence>
                  {hasFocus ? (
                    <motion.div
                      key="focus"
                      className="focus-analysis-view"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10, position: 'absolute' }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <ParentSize>
                        {({ width, height }) => <SpeedDistanceGraph width={width} height={height} />}
                      </ParentSize>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="global"
                      className="global-analysis-view"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10, position: 'absolute' }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
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
            <div className={`hud-panel hud-bottom-right ${!hasFocus ? 'inactive' : 'highlight-section'}`}>
              <AnimatePresence>
                {hasFocus && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    className="speed-cluster focused"
                  >
                    <div className="cluster-side left">
                      <Compass size={96} />
                    </div>
                    <div className="cluster-center">
                      <Speedometer width={230} height={230} />
                    </div>
                    <div className="cluster-side right">
                      <VehicleStatus size={96} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
