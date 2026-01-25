import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircuitOutline } from './CircuitOutline';

interface CatalogRace {
    round: number;
    name: string;
    location: string;
    official_name: string;
}

interface Catalog {
    seasons: Record<string, CatalogRace[]>;
}

interface MissionManagerProps {
    onClose: () => void;
    currentSessions: any[];
    onRefresh: () => void;
}

export const MissionManager: React.FC<MissionManagerProps> = ({ onClose, currentSessions, onRefresh }) => {
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [selectedYear, setSelectedYear] = useState('2024');
    const [installing, setInstalling] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [installProgress, setInstallProgress] = useState(0);

    useEffect(() => {
        fetch('/f1_catalog.json')
            .then(res => res.json())
            .then(setCatalog)
            .catch(err => console.error("Failed to load catalog:", err));
    }, []);

    const handleAddRace = async (year: string, race: CatalogRace) => {
        const missionName = `${year} ${race.name} GP`;
        const circuitId = `${year}-${race.name.toLowerCase().replace(/\s+/g, '_')}`;

        setInstalling(race.official_name);
        setInstallProgress(5);
        setStatusMessage(`INITIALIZING MISSION: Connecting to ${missionName} data stream...`);

        console.log(`[SYSTEM_REQUEST] ACTION: ADD_MISSION | YEAR: ${year} | RACE: "${race.official_name}" | ID: ${circuitId}`);

        // Trigger the bridge server
        try {
            fetch('http://localhost:3001/add-mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: year,
                    race_name: race.name,
                    laps: 5
                })
            }).catch(e => console.warn("Bridge server not responding. Falling back to manual mode."));
        } catch (e) {
            console.error("Failed to signal bridge server:", e);
        }

        let attempts = 0;
        const maxAttempts = 120; // 6 minutes total (downloads can be slow)
        const pollInterval = setInterval(() => {
            attempts++;
            onRefresh();

            // Calculate progress: Start at 5, aim for 95 while polling
            const progress = Math.min(95, 5 + (attempts / maxAttempts) * 90);
            setInstallProgress(progress);

            if (attempts > maxAttempts) {
                clearInterval(pollInterval);
                setInstalling(null);
                setInstallProgress(0);
                setStatusMessage(`DOWNLINK INTERRUPTED: Check mission agent status.`);
            } else {
                setStatusMessage(`SYNCING TELEMETRY: Receiving ${missionName} data packet (${Math.round(progress)}%)...`);
            }
        }, 3000);

        // Store interval ID to clean up if needed
        (window as any)._installInterval = pollInterval;
    };

    // Use effect to watch for completion - avoids stale closure issue
    useEffect(() => {
        if (!installing) return;

        const isNowInstalled = currentSessions.some(c =>
            installing.includes(c.name) ||
            c.id.includes(installing.toLowerCase().replace(/\s+/g, '-')) ||
            c.id.includes(installing.toLowerCase().split(' ')[0])
        );

        if (isNowInstalled) {
            const interval = (window as any)._installInterval;
            if (interval) clearInterval(interval);

            setInstallProgress(100);
            setStatusMessage(`MISSION SECURED: Data stream active.`);

            setTimeout(() => {
                setInstalling(null);
                setInstallProgress(0);
                setTimeout(() => setStatusMessage(null), 5000);
            }, 800);
        }
    }, [currentSessions, installing]);

    const handleDeleteRace = async (circuitId: string) => {
        if (confirm("Are you sure you want to decommission this mission? Telemetry data will be removed from the hub.")) {
            setStatusMessage(`DECOMMISSIONING: Removing mission ${circuitId}...`);
            console.log(`[SYSTEM_REQUEST] ACTION: DELETE_MISSION | ID: ${circuitId}`);

            // Short delay to allow for removal perception
            setTimeout(() => {
                onRefresh();
                setStatusMessage(`MISSION REMOVED: Registry updated.`);
                setTimeout(() => setStatusMessage(null), 3000);
            }, 1000);
        }
    };

    const yearOptions = catalog ? Object.keys(catalog.seasons).sort((a, b) => b.localeCompare(a)) : [];
    const availableRaces = catalog?.seasons[selectedYear] || [];

    return (
        <div className="mission-manager-view">
            <AnimatePresence>
                {statusMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="system-alert-bar"
                    >
                        <div className="alert-content">
                            <span className="pulse-dot" />
                            <div className="text-progress">
                                <span className="message">{statusMessage}</span>
                                {installing && (
                                    <>
                                        <div className="progress-container">
                                            <motion.div
                                                className="progress-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${installProgress}%` }}
                                                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                                            />
                                        </div>
                                        <div className="command-hud">
                                            <span className="terminal-prefix">&gt;_</span>
                                            <span className="command-text">AGENT_EXEC: mission_control.py add "{installing}"</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="admin-grid">
                {/* Left Panel: Catalog Addition */}
                <div className="admin-panel catalog-panel">
                    <header className="panel-header">
                        <h3>HISTORICAL CATALOG</h3>
                        <div className="year-selector">
                            {yearOptions.map(y => (
                                <button
                                    key={y}
                                    className={`year-btn ${selectedYear === y ? 'active' : ''}`}
                                    onClick={() => setSelectedYear(y)}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="catalog-list">
                        {availableRaces.map((race, i) => {
                            const isInstalled = currentSessions.some(c => c.name.includes(race.name));
                            return (
                                <div key={i} className={`catalog-item ${isInstalled ? 'installed' : ''}`}>
                                    <div className="item-info">
                                        <span className="round">R{race.round}</span>
                                        <div className="name-loc">
                                            <span className="name">{race.name}</span>
                                            <span className="loc">{race.location}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={`add-btn ${installing === race.official_name ? 'loading' : ''}`}
                                        disabled={!!isInstalled || !!installing}
                                        onClick={() => handleAddRace(selectedYear, race)}
                                    >
                                        {isInstalled ? 'INSTALLED' : (installing === race.official_name ? 'LINKING...' : 'INITIALIZE')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Installed Management */}
                <div className="admin-panel storage-panel">
                    <header className="panel-header">
                        <div className="title-stack">
                            <h3>MISSION STORAGE</h3>
                            <span className="file-count">{currentSessions.length} ACTIVE PROFILES</span>
                        </div>
                        <button className="exit-admin-btn" onClick={onClose}>
                            EXIT MANAGEMENT
                        </button>
                    </header>

                    <div className="storage-list">
                        {currentSessions.map((circuit, i) => (
                            <div key={i} className="storage-item">
                                <div className="storage-info">
                                    <CircuitOutline
                                        circuitId={circuit.id}
                                        dynamicPath={circuit.track_path}
                                        className="storage-mini-map"
                                    />
                                    <div className="text">
                                        <span className="title">{circuit.name}</span>
                                        <span className="meta">{circuit.sessions.length} Session Variants</span>
                                    </div>
                                </div>
                                <button className="delete-btn" onClick={() => handleDeleteRace(circuit.id)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
