import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircuitOutline } from './CircuitOutline';
import { useRaceStore } from '../store/useRaceStore';

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
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const bridgeStatus = useRaceStore(state => state.bridgeStatus);
    const addJob = useRaceStore(state => state.addJob);
    const updateJob = useRaceStore(state => state.updateJob);
    const activeJobs = useRaceStore(state => state.activeJobs);

    useEffect(() => {
        fetch('/f1_catalog.json')
            .then(res => res.json())
            .then(setCatalog)
            .catch(err => console.error("Failed to load catalog:", err));
    }, []);

    const handleAddRace = async (year: string, race: CatalogRace) => {
        const missionName = `${year} ${race.name} GP`;
        const circuitId = `${year}-${race.name.toLowerCase().replace(/\s+/g, '_')}`;
        const jobId = `init-${circuitId}`;

        addJob({
            id: jobId,
            name: missionName,
            progress: 5,
            status: 'initializing',
            message: `Connecting to ${missionName} data stream...`
        });

        console.log(`[SYSTEM_REQUEST] ACTION: ADD_MISSION | YEAR: ${year} | RACE: "${race.official_name}" | ID: ${circuitId}`);

        try {
            const response = await fetch('http://localhost:3001/add-mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: year,
                    race_name: race.name,
                    laps: 5
                })
            });

            if (!response.ok) throw new Error('Bridge responded with error');

        } catch (e) {
            console.error("Failed to signal bridge server:", e);
            updateJob(jobId, {
                status: 'failed',
                message: 'BRIDGE OFFLINE',
                progress: 0
            });
            return; // Stop here if bridge is dead
        }

        let attempts = 0;
        const maxAttempts = 120;
        const pollInterval = setInterval(() => {
            attempts++;
            onRefresh();

            const progress = Math.min(95, 5 + (attempts / maxAttempts) * 90);
            updateJob(jobId, {
                progress,
                message: `Receiving ${missionName} data packet (${Math.round(progress)}%)...`,
                status: 'syncing'
            });

            if (attempts > maxAttempts) {
                clearInterval(pollInterval);
                updateJob(jobId, { status: 'failed', message: 'DOWNLINK INTERRUPTED' });
            }
        }, 3000);

        (window as any)[`_installInterval_${jobId}`] = pollInterval;
    };

    // Use effect to watch for completion - avoids stale closure issue
    useEffect(() => {
        activeJobs.forEach(job => {
            if (job.status === 'completed' || job.status === 'failed') return;

            const isNowInstalled = currentSessions.some(c => {
                // job.id is formatted as `init-${year}-${name}`
                const circuitIdFromJob = job.id.replace('init-', '');
                return c.id.toLowerCase() === circuitIdFromJob.toLowerCase();
            });

            if (isNowInstalled) {
                const interval = (window as any)[`_installInterval_${job.id}`];
                if (interval) clearInterval(interval);

                updateJob(job.id, {
                    progress: 100,
                    status: 'completed',
                    message: 'MISSION SECURED: Data stream active.'
                });
            }
        });
    }, [currentSessions, activeJobs, updateJob]);

    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const requestDelete = (circuitId: string) => {
        setDeleteTarget(circuitId);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        const circuitId = deleteTarget;
        setDeleteTarget(null); // Close modal immediately

        setStatusMessage(`DECOMMISSIONING: Removing mission ${circuitId}...`);
        console.log(`[SYSTEM_REQUEST] ACTION: DELETE_MISSION | ID: ${circuitId}`);

        try {
            // Call the bridge server to perform actual deletion
            await fetch('http://localhost:3001/delete-mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ circuit_id: circuitId })
            });

            // Short delay to allow for removal perception & backend processing
            setTimeout(() => {
                onRefresh();
                setStatusMessage(`MISSION REMOVED: Registry updated.`);
                setTimeout(() => setStatusMessage(null), 3000);
            }, 1500);

        } catch (e) {
            console.error("Failed to signal bridge server:", e);
            setStatusMessage("ERROR: Could not contact mission control.");
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const cancelDelete = () => {
        setDeleteTarget(null);
    };

    const yearOptions = catalog ? Object.keys(catalog.seasons).sort((a, b) => b.localeCompare(a)) : [];
    const availableRaces = catalog?.seasons[selectedYear] || [];

    return (
        <div className="mission-manager-view">
            <AnimatePresence>
                {activeJobs.map(job => (
                    <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="system-alert-bar"
                    >
                        <div className="alert-content">
                            <span className="pulse-dot" />
                            <div className="text-progress">
                                <span className="message">{job.message || statusMessage}</span>
                                {job.status !== 'completed' && job.status !== 'failed' && (
                                    <>
                                        <div className="progress-container">
                                            <motion.div
                                                className="progress-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${job.progress}%` }}
                                                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                                            />
                                        </div>
                                        <div className="command-hud">
                                            <span className="terminal-prefix">&gt;_</span>
                                            <span className="command-text">AGENT_EXEC: mission_control.py add "{job.name}"</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            <AnimatePresence>
                {deleteTarget && (
                    <motion.div
                        className="confirmation-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="confirmation-box"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="modal-header">
                                <span className="warning-icon">⚠</span>
                                <h3>CONFIRM DECOMMISSION</h3>
                            </div>
                            <p>
                                Are you sure you want to remove mission <strong>{deleteTarget}</strong>?
                                <br />
                                <span className="sub-text">Telemetry data will be permanently deleted from the local hub.</span>
                            </p>
                            <div className="modal-actions">
                                <button className="modal-btn cancel" onClick={cancelDelete}>
                                    ABORT
                                </button>
                                <button className="modal-btn confirm" onClick={confirmDelete}>
                                    EXECUTE DELETE
                                </button>
                            </div>
                        </motion.div>
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
                            const activeJob = activeJobs.find(j => j.name.includes(race.name));

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
                                        className={`add-btn ${activeJob ? 'loading' : ''}`}
                                        disabled={!!isInstalled || !!activeJob}
                                        onClick={() => handleAddRace(selectedYear, race)}
                                    >
                                        {isInstalled ? 'INSTALLED' : (activeJob ? 'LINKING...' : 'INITIALIZE')}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3>MISSION STORAGE</h3>
                                <div className={`status-badge ${bridgeStatus}`} style={{
                                    fontSize: '0.6rem',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: bridgeStatus === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: bridgeStatus === 'online' ? '#10b981' : '#ef4444',
                                    border: `1px solid ${bridgeStatus === 'online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    fontWeight: 800,
                                    letterSpacing: '0.05em'
                                }}>
                                    BRIDGE {bridgeStatus.toUpperCase()}
                                </div>
                            </div>
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
                                <button className="delete-btn" onClick={() => requestDelete(circuit.id)}>
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
