import { useState, useEffect } from 'react';
import { MissionManager } from './MissionManager';
import { getCachedData } from '../utils/db';
import { useRaceStore } from '../store/useRaceStore';
import type { CircuitMetadata } from '../store/useRaceStore';
import { motion, AnimatePresence } from 'framer-motion';
import { CircuitOutline } from './CircuitOutline';
import '../styles/SessionSelector.css';

interface Session {
    id: string;
    name: string;
    description: string;
    file: string;
    metadata?: {
        winner?: {
            name: string;
            team: string;
            color: string;
        };
        weather?: {
            temp: number;
            condition: string;
        };
    };
}

interface Circuit {
    id: string;
    name: string;
    location: string;
    lapLength: number;
    track_path?: string; // Added track_path
    sectors: {
        s1_end: number;
        s2_end: number;
    };
    sessions: Session[];
}

interface Manifest {
    circuits: Circuit[];
}

interface SessionSelectorProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const SessionSelector = ({ isOpen, setIsOpen }: SessionSelectorProps) => {
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'selection' | 'management'>('selection');
    const loadRaceData = useRaceStore(state => state.loadRaceData);
    const currentCircuit = useRaceStore(state => state.circuitMetadata);
    const raceData = useRaceStore(state => state.raceData);

    useEffect(() => {
        if (isOpen) {
            fetch('/sessions.json')
                .then(res => res.json())
                .then(setManifest)
                .catch(err => console.error("Failed to load sessions:", err));
        }
    }, [isOpen]);

    const refreshManifest = () => {
        fetch(`/sessions.json?t=${Date.now()}`)
            .then(res => res.json())
            .then(setManifest);
    };

    const handleSelectSession = async (circuit: Circuit, session: Session) => {
        setLoading(true);
        const cacheKey = `race_${session.id}`;

        try {
            // 1. Try Cache First
            const cached = await getCachedData(cacheKey);
            const metadata: CircuitMetadata = {
                id: circuit.id,
                name: circuit.name,
                location: circuit.location,
                lapLength: circuit.lapLength,
                sectors: circuit.sectors
            };

            if (cached) {
                console.log("Loading session from cache:", cacheKey);
                loadRaceData(cached.raceData, metadata);
                setIsOpen(false);
                return;
            }

            // 2. Fallback to Fetch
            const response = await fetch(session.file);
            const data = await response.json();

            loadRaceData(data, metadata, cacheKey);
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to load session data:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="session-selector-overlay">
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            className="selector-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            className="race-command-center"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            <div className="selector-header">
                                <div className="header-top-row">
                                    <div className="header-title">
                                        <span className="accent-line" />
                                        <h2>RACE COMMAND CENTER</h2>
                                        <span className="subtitle">SELECT MISSION PROFILE</span>
                                    </div>
                                    <button className="close-btn" onClick={() => setIsOpen(false)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>

                                <div className="header-tabs">
                                    <button
                                        className={`tab-btn ${view === 'selection' ? 'active' : ''}`}
                                        onClick={() => setView('selection')}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <rect x="3" y="3" width="7" height="7"></rect>
                                            <rect x="14" y="3" width="7" height="7"></rect>
                                            <rect x="14" y="14" width="7" height="7"></rect>
                                            <rect x="3" y="14" width="7" height="7"></rect>
                                        </svg>
                                        MISSION PROFILES
                                    </button>
                                    <button
                                        className={`tab-btn ${view === 'management' ? 'active' : ''}`}
                                        onClick={() => setView('management')}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                        </svg>
                                        SYSTEM MGMT
                                    </button>
                                </div>
                            </div>

                            <div className="selector-content">
                                {loading ? (
                                    <div className="loading-container">
                                        <div className="telemetry-pulse-icon" />
                                        <span className="loading-text">RECONFIGURING DATA STREAM...</span>
                                    </div>
                                ) : view === 'management' ? (
                                    <MissionManager
                                        onClose={() => setView('selection')}
                                        currentSessions={manifest?.circuits || []}
                                        onRefresh={refreshManifest}
                                    />
                                ) : (
                                    <div className="circuit-grid">
                                        {manifest?.circuits.map(circuit => (
                                            <div key={circuit.id} className="circuit-card">
                                                <div className="card-header">
                                                    <span className="year">2024</span>
                                                    <h3>{circuit.name}</h3>
                                                    <span className="location">{circuit.location}</span>
                                                </div>

                                                <CircuitOutline
                                                    circuitId={circuit.id}
                                                    dynamicPath={circuit.track_path}
                                                    className="circuit-outline-icon"
                                                />

                                                <div className="card-stats">
                                                    <div className="stat">
                                                        <span className="label">LAP LENGTH</span>
                                                        <span className="value">{(circuit.lapLength / 1000).toFixed(3)} KM</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="label">SECTORS</span>
                                                        <span className="value">3</span>
                                                    </div>
                                                </div>

                                                <div className="session-list">
                                                    {circuit.sessions.map(session => {
                                                        const isActive = currentCircuit?.id === circuit.id &&
                                                            raceData?.race_name.includes(circuit.name);

                                                        return (
                                                            <button
                                                                key={session.id}
                                                                className={`session-btn ${isActive ? 'active' : ''}`}
                                                                onClick={() => handleSelectSession(circuit, session)}
                                                            >
                                                                <div className="session-main">
                                                                    <span className="session-name">{session.name}</span>
                                                                    {session.metadata?.winner && (
                                                                        <div className="session-details">
                                                                            <span className="winner-tag" style={{ borderLeft: `2px solid ${session.metadata.winner.color}` }}>
                                                                                WINNER: {session.metadata.winner.name}
                                                                            </span>
                                                                            {session.metadata.weather && (
                                                                                <span className="weather-tag">
                                                                                    {session.metadata.weather.condition} • {session.metadata.weather.temp}°C
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isActive ? (
                                                                    <div className="active-tag">ACTIVE</div>
                                                                ) : (
                                                                    <div className="select-arrow">
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                            <polyline points="9 18 15 12 9 6"></polyline>
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="selector-footer">
                                <div className="system-status">
                                    <span className="dot" />
                                    SYSTEM READY • ENCRYPTED DOWNLINK ACTIVE
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
