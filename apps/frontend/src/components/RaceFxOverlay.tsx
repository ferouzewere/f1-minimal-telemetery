import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';
import { Speedometer } from './Speedometer';
import { getFlagUrl } from '../utils/countryMapping';

export const RaceFxOverlay: React.FC = () => {
    const raceData = useRaceStore(state => state.raceData);
    const circuitMetadata = useRaceStore(state => state.circuitMetadata);
    const currentTime = useRaceStore(state => state.currentTime);
    const setIsPlaying = useRaceStore(state => state.setIsPlaying);
    const raceDuration = useRaceStore(state => state.raceData ? state.raceData.drivers[0].telemetry[state.raceData.drivers[0].telemetry.length - 1].t : 0);

    // Stages: IDLE, START_DETAILS, START_COUNTDOWN, END_CELEBRATION
    const [stage, setStage] = useState<'IDLE' | 'START_DETAILS' | 'START_COUNTDOWN' | 'END_CELEBRATION'>('IDLE');

    // Local state for revving simulation
    const [revRpm, setRevRpm] = useState(4000);
    const [countdownNum, setCountdownNum] = useState<number | null>(null);

    // Track if we've shown the start sequence this session to avoid loop on seek
    const hasShownStartRef = useRef(false);

    // START SEQUENCE HEADER TRIGGER
    useEffect(() => {
        // If we are at the very start ( < 2 seconds) and haven't shown intro
        if (currentTime < 2000 && !hasShownStartRef.current && raceData) {
            hasShownStartRef.current = true;
            setStage('START_DETAILS');

            // Sequence Timing
            // 1. Details + Revving (0s - 4s)
            // 2. Countdown (4s - 7s)
            // 3. Go -> Idle

            setTimeout(() => {
                setStage('START_COUNTDOWN');
                startCountdown();
            }, 4000);
        }
    }, [currentTime, raceData]);

    // END SEQUENCE TRIGGER
    // Trigger if we are near end or status is checkered
    // Simplified: triggers if time >= duration - 1s
    useEffect(() => {
        if (raceDuration > 0 && currentTime >= raceDuration - 1000 && stage === 'IDLE') {
            setStage('END_CELEBRATION');
        } else if (currentTime < raceDuration - 5000 && stage === 'END_CELEBRATION') {
            // Reset if we scrub back
            setStage('IDLE');
        }
    }, [currentTime, raceDuration, stage]);

    // REVVING SIMULATION (Mechanical Throttle Blips)
    useEffect(() => {
        if (stage !== 'START_DETAILS') return;

        let targetRpm = 11000 + Math.random() * 2000;
        let isIncreasing = true;

        const interval = setInterval(() => {
            setRevRpm(prev => {
                const noise = (Math.random() - 0.5) * 400; // Mechanical vibration
                let next;

                if (isIncreasing) {
                    // Sharp rise (hitting the gas)
                    next = prev + 800;
                    if (prev >= targetRpm) {
                        isIncreasing = false;
                        targetRpm = 6000 + Math.random() * 2000; // Fall to random neutral point
                    }
                } else {
                    // Slower decay (engine braking/idle)
                    next = prev - 400;
                    if (prev <= targetRpm) {
                        isIncreasing = true;
                        targetRpm = 11000 + Math.random() * 3000; // Pick next rev target
                    }
                }

                return Math.max(4000, Math.min(15000, next + noise));
            });
        }, 30); // Faster tick for smoother jitter

        return () => clearInterval(interval);
    }, [stage]);

    const startCountdown = () => {
        setCountdownNum(1);
        setTimeout(() => setCountdownNum(2), 1000);
        setTimeout(() => setCountdownNum(3), 2000);
        setTimeout(() => {
            setCountdownNum(null); // GO!
            setIsPlaying(true); // Start the race!
            setTimeout(() => setStage('IDLE'), 300);
        }, 3000);
    };


    // Calculate Top 3 for Podium
    const top3Drivers = raceData?.drivers.slice(0, 3) || [];

    return (
        <AnimatePresence>
            {/* --- START: DETAILS & REVVING --- */}
            {stage === 'START_DETAILS' && (
                <motion.div
                    className="race-fx-overlay"
                    key="start-details"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                    transition={{ duration: 0.5 }}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 100,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                        {circuitMetadata?.location && (
                            <img
                                src={getFlagUrl(circuitMetadata.location) || ''}
                                alt="Flag"
                                style={{ height: '80px', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                            />
                        )}
                        <div style={{ textAlign: 'left' }}>
                            <h1 style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1, margin: 0, letterSpacing: '-0.02em' }}>
                                {raceData?.race_name || "GRAND PRIX"}
                            </h1>
                            <h2 style={{ fontSize: '2rem', color: '#94a3b8', margin: 0, fontWeight: 600 }}>
                                {circuitMetadata?.name.toUpperCase()}
                            </h2>
                        </div>
                    </div>

                    <div style={{ transform: 'scale(1.2)' }}>
                        <Speedometer
                            width={300}
                            height={300}
                            overrideRpm={revRpm}
                            overrideSpeed={0}
                            overrideGear={1}
                            overrideThrottle={100}
                        />
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, repeat: Infinity, repeatType: "reverse", duration: 0.8 }}
                        style={{ marginTop: '8rem', color: '#facc15', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.2em' }}
                    >
                        SYSTEMS CHECK...
                    </motion.div>
                </motion.div>
            )}

            {/* --- START: COUNTDOWN & FLAGS --- */}
            {stage === 'START_COUNTDOWN' && (
                <div
                    className="status-notification-stack"
                    style={{
                        pointerEvents: 'none',
                        position: 'fixed',
                        top: '8.5rem',
                        left: '1rem',
                        zIndex: 2000
                    }}
                >
                    <motion.div
                        layout
                        initial={{ x: -20, opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                        animate={{ x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{
                            x: -10,
                            opacity: 0,
                            scale: 0.98,
                            filter: 'blur(2px)',
                            transition: { duration: 0.2, ease: "easeOut" }
                        }}
                        className="status-notification-item status"
                        style={{
                            borderLeftColor: '#ffffff',
                            padding: 0, // Reset padding for custom layout
                            overflow: 'hidden',
                            width: '260px',
                            height: '55px',
                            display: 'flex',
                            position: 'relative'
                        }}
                    >
                        {/* LEFT: Checkered Flag Background Pattern */}
                        <motion.div style={{
                            position: 'absolute',
                            left: 0, top: 0, bottom: 0, width: '60%',
                            maskImage: 'linear-gradient(to right, black 20%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, black 20%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                            opacity: 0.7
                        }}
                            animate={{
                                x: [0, -3, 0, 3, 0],
                                scaleX: [1, 1.02, 1, 0.98, 1],
                            }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}>
                            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <pattern id="checkered" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                        <rect x="0" y="0" width="10" height="10" fill="white" />
                                        <rect x="10" y="0" width="10" height="10" fill="black" />
                                        <rect x="0" y="10" width="10" height="10" fill="black" />
                                        <rect x="10" y="10" width="10" height="10" fill="white" />
                                    </pattern>
                                    <filter id="fabric-depth" x="-50%" y="-50%" width="200%" height="200%">
                                        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="2" />
                                        <feDisplacementMap in="SourceGraphic" scale="3" />
                                    </filter>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#checkered)" transform="skewX(-15)" filter="url(#fabric-depth)" />
                            </svg>
                        </motion.div>

                        {/* RIGHT: Countdown Number */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '2rem',
                            position: 'relative',
                            zIndex: 2
                        }}>
                            <AnimatePresence mode="wait">
                                {countdownNum !== null ? (
                                    <motion.div
                                        key={countdownNum}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        style={{
                                            fontSize: '3.5rem',
                                            fontWeight: 900,
                                            fontFamily: 'Outfit',
                                            lineHeight: 1,
                                            fontStyle: 'italic',
                                            color: countdownNum === 1 ? '#ef4444' : countdownNum === 2 ? '#facc15' : '#22c55e',
                                            textShadow: '0 0 20px rgba(0,0,0,0.5)'
                                        }}
                                    >
                                        {countdownNum}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="go"
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        style={{
                                            fontSize: '3.5rem',
                                            fontWeight: 900,
                                            fontFamily: 'Outfit',
                                            lineHeight: 1,
                                            fontStyle: 'italic',
                                            color: '#22c55e',
                                        }}
                                    >
                                        GO
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* --- END: PODIUM NOTIFICATIONS --- */}
            {stage === 'END_CELEBRATION' && (
                <div className="podium-overlay-stack">
                    {top3Drivers.map((driver, index) => {
                        const position = index + 1;
                        const medals = ['🥇', '🥈', '🥉'];
                        const colors = ['#ffd700', '#c0c0c0', '#cd7f32']; // Gold, Silver, Bronze

                        return (
                            <motion.div
                                key={driver.driver_abbr}
                                layout
                                initial={{ x: -20, opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                animate={{ x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                exit={{
                                    x: -10,
                                    opacity: 0,
                                    scale: 0.98,
                                    filter: 'blur(2px)',
                                    transition: { duration: 0.2, ease: "easeOut" }
                                }}
                                transition={{ delay: index * 0.4 }}
                                className="podium-item"
                                style={{ borderLeftColor: colors[index] }}
                            >
                                <div className="podium-content">
                                    {/* Medal */}
                                    <div className="podium-medal">
                                        {medals[index]}
                                    </div>

                                    {/* Driver Info */}
                                    <div className="podium-driver-info">
                                        <div className="podium-pos">
                                            P{position}
                                        </div>
                                        <div className="podium-name">
                                            {driver.driver_name}
                                        </div>
                                        <div className="podium-team" style={{ color: driver.team_color || '#64748b' }}>
                                            {driver.team}
                                        </div>
                                    </div>

                                    {/* Driver Profile Image */}
                                    <img
                                        src={`/drivers/${driver.driver_abbr.toLowerCase()}.png`}
                                        alt={driver.driver_name}
                                        className="podium-driver-image"
                                        onError={(e) => {
                                            // Fallback to position badge if image not found
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    {/* Fallback Position Badge (hidden by default) */}
                                    <div className="podium-fallback-badge" style={{ backgroundColor: colors[index] }}>
                                        {position}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </AnimatePresence>
    );
};
