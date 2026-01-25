import React, { useState, useEffect } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import type { CircuitMetadata } from '../store/useRaceStore';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/SessionSelector.css';

interface Session {
    id: string;
    name: string;
    description: string;
    file: string;
}

interface Circuit {
    id: string;
    name: string;
    location: string;
    lapLength: number;
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

export const SessionSelector: React.FC<SessionSelectorProps> = ({ isOpen, setIsOpen }) => {
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loading, setLoading] = useState(false);
    const loadRaceData = useRaceStore(state => state.loadRaceData);
    const currentCircuit = useRaceStore(state => state.circuitMetadata);
    const raceData = useRaceStore(state => state.raceData);

    useEffect(() => {
        fetch('/sessions.json')
            .then(res => res.json())
            .then(setManifest)
            .catch(err => console.error("Failed to load sessions:", err));
    }, []);

    const handleSelectSession = async (circuit: Circuit, session: Session) => {
        setLoading(true);
        try {
            const response = await fetch(session.file);
            const data = await response.json();

            const metadata: CircuitMetadata = {
                id: circuit.id,
                name: circuit.name,
                location: circuit.location,
                lapLength: circuit.lapLength,
                sectors: circuit.sectors
            };

            loadRaceData(data, metadata);
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

                            <div className="selector-content">
                                {loading ? (
                                    <div className="loading-container">
                                        <div className="telemetry-pulse-icon" />
                                        <span className="loading-text">RECONFIGURING DATA STREAM...</span>
                                    </div>
                                ) : (
                                    <div className="circuit-grid">
                                        {manifest?.circuits.map(circuit => (
                                            <div key={circuit.id} className="circuit-card">
                                                <div className="card-header">
                                                    <span className="year">2024</span>
                                                    <h3>{circuit.name}</h3>
                                                    <span className="location">{circuit.location}</span>
                                                </div>

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
                                                                <span className="session-name">{session.name}</span>
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
