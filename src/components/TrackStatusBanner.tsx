import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';
import { getInterpolatedFrame } from '../utils/interpolation';

interface Notification {
    id: string;
    type: 'status' | 'weather' | 'info' | 'pit' | 'lap';
    label: string;
    description: string;
    insight?: string; // Educational "why"
    color: string;
    timestamp: number;
    icon?: React.ReactNode;
    duration?: number;
}

const STATUS_DETAILS: Record<string, { label: string; description: string; insight: string; color: string }> = {
    '1': {
        label: 'TRACK CLEAR',
        description: 'Normal racing conditions.',
        insight: 'Green Flag: Speed and overtaking restriction lifted.',
        color: '#22c55e'
    },
    '2': {
        label: 'YELLOW FLAG',
        description: 'Hazard on track.',
        insight: 'Requires drivers to slow down. Overtaking is prohibited to protect track workers.',
        color: '#facc15'
    },
    '4': {
        label: 'SAFETY CAR',
        description: 'Physical Safety Car deployed.',
        insight: 'The car leads the pack to bunch up the field, creating a safe window for recovery vehicles.',
        color: '#facc15'
    },
    '5': {
        label: 'RED FLAG',
        description: 'Session suspended.',
        insight: 'Immediate stop due to severe danger or weather. All cars must return to pits.',
        color: '#ef4444'
    },
    '6': {
        label: 'VSC',
        description: 'Virtual Safety Car.',
        insight: 'Requires a 40% speed reduction. Maintains the time gaps between drivers without a real car.',
        color: '#facc15'
    },
    '7': {
        label: 'CHECKERED FLAG',
        description: 'Session completed.',
        insight: 'Drivers must finish their lap and enter the pits immediately.',
        color: '#ffffff'
    },
};

export const TrackStatusBanner: React.FC = () => {
    const currentTrackStatus = useRaceStore(state => state.currentTrackStatus);
    const currentWeather = useRaceStore(state => state.currentWeather);
    const currentTime = useRaceStore(state => state.currentTime);
    const raceData = useRaceStore(state => state.raceData);
    const totalLaps = useRaceStore(state => state.totalLaps);
    const pitStops = useRaceStore(state => state.pitStops);
    const circuitMetadata = useRaceStore(state => state.circuitMetadata);

    const [notifications, setNotifications] = useState<Notification[]>([]);

    const lastStatusRef = useRef<string | null>(null);
    const lastRainRef = useRef<boolean | null>(null);
    const lastRaceIdRef = useRef<string | null>(null);
    const lastLapRef = useRef<number>(1);
    const processedPitStops = useRef<Set<string>>(new Set());
    const lastTimeRef = useRef(currentTime);

    // Reset processed events if we rewind significantly
    useEffect(() => {
        if (currentTime < lastTimeRef.current - 2000) {
            processedPitStops.current.clear();
            // Optional: clear notifications too if desiring a clean slate
            // setNotifications([]);
        }
        lastTimeRef.current = currentTime;
    }, [currentTime]);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => {
            // Filter out existing notifications of the same type to avoid clutter
            let filtered = prev;
            if (notif.type === 'lap' || notif.type === 'status') {
                filtered = prev.filter(n => n.type !== notif.type);
            }

            // Add new notification and keep only the last 3
            return [...filtered, notif].slice(-3);
        });

        if (notif.duration !== Infinity) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notif.id));
            }, notif.duration || 5000);
        }
    };

    // 1. Initial Race Info (Delayed)
    useEffect(() => {
        if (raceData && raceData.race_name !== lastRaceIdRef.current) {
            lastRaceIdRef.current = raceData.race_name;
            processedPitStops.current.clear(); // Reset pits for new session

            const timer = setTimeout(() => {
                const weatherCondition = currentWeather?.rainfall ? "RAINY CONDITIONS" : "DRY TRACK";
                addNotification({
                    id: `info-${Date.now()}`,
                    type: 'info',
                    label: raceData.race_name.toUpperCase(),
                    description: `${circuitMetadata?.name || 'Grand Prix'} - ${weatherCondition}`,
                    color: '#6366f1',
                    timestamp: Date.now(),
                    duration: 8000,
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                        </svg>
                    )
                });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [raceData, circuitMetadata, currentWeather]); // Added currentWeather dependency for initial state

    // 2. Monitor Track Status & Live Messages
    useEffect(() => {
        const statusId = currentTrackStatus?.status || '1';

        // Ignore Checkered Flag (7) notification to keep UI minimal at session end
        if (statusId === '7') return;

        if (statusId !== lastStatusRef.current) {
            const details = STATUS_DETAILS[statusId] || STATUS_DETAILS['1'];

            if (lastStatusRef.current !== null || statusId !== '1') {
                let icon = undefined;

                // Specialized icons for Safety Car / Flags
                if (statusId === '4' || statusId === '6') { // SC / VSC
                    icon = (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5">
                            <rect x="3" y="14" width="18" height="6" rx="1" />
                            <path d="M7 14V9l2-2h6l2 2v5" />
                            <circle cx="9" cy="17" r="2" />
                            <circle cx="15" cy="17" r="2" />
                        </svg>
                    );
                }

                addNotification({
                    id: `status-${Date.now()}`,
                    type: 'status',
                    label: details.label,
                    description: currentTrackStatus?.message || details.description,
                    insight: details.insight,
                    color: details.color,
                    timestamp: Date.now(),
                    duration: statusId === '1' ? 4000 : Infinity,
                    icon
                });
            }
            lastStatusRef.current = statusId;
        }
    }, [currentTrackStatus]);

    // 3. Monitor Lap Progress (Based on Leader)
    useEffect(() => {
        if (!raceData || !raceData.drivers[0]) return;
        const leader = raceData.drivers[0];
        const frame = getInterpolatedFrame(leader.telemetry, currentTime).frame;
        const currentLap = frame.lap;

        if (currentLap > lastLapRef.current) {
            addNotification({
                id: `lap-${Date.now()}`,
                type: 'lap',
                label: `LAP ${currentLap} / ${totalLaps}`,
                description: 'Official timing update.',
                insight: 'The lap counter is based on the race leader.',
                color: '#94a3b8',
                timestamp: Date.now(),
                duration: 5000,
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                )
            });
            lastLapRef.current = currentLap;
        }
    }, [currentTime, raceData, totalLaps]);

    // 4. Monitor Pit Stops (Global Alerts)
    useEffect(() => {
        pitStops.forEach(pit => {
            const pitId = `${pit.driver_abbr}-${pit.lap}`;
            // If the pit stop happened in the "current" simulation window (e.g. within last 2s of current time)
            if (pit.timestamp <= currentTime && pit.timestamp > currentTime - 2000 && !processedPitStops.current.has(pitId)) {
                addNotification({
                    id: `pit-${pitId}`,
                    type: 'pit',
                    label: `PIT ENTRY: ${pit.driver_abbr}`,
                    description: `Lap ${pit.lap}`,
                    insight: 'Cars pit to change tyres or fix damage. Speed is limited below 80km/h.',
                    color: '#facc15',
                    timestamp: Date.now(),
                    duration: 6000,
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    )
                });
                processedPitStops.current.add(pitId);
            }
        });
    }, [currentTime, pitStops]);

    // 5. Weather Changes
    useEffect(() => {
        const isRaining = currentWeather?.rainfall || false;
        if (isRaining !== lastRainRef.current && isRaining) {
            addNotification({
                id: `weather-${Date.now()}`,
                type: 'weather',
                label: 'RAINFALL DETECTED',
                description: 'Exercise caution. Grip levels reduced.',
                insight: 'Wet tracks reduce grip. Drivers balance speed and safety until pitting for Wet tyres.',
                color: '#3b82f6',
                timestamp: Date.now(),
                duration: 8000,
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 13a4 4 0 0 1-8 0" /><path d="M8 10a4 4 0 0 1 8 0" /><path d="M12 10V6" /><path d="M12 2v1" />
                    </svg>
                )
            });
            lastRainRef.current = isRaining;
        } else if (!isRaining) {
            lastRainRef.current = isRaining;
        }
    }, [currentWeather]);

    return (
        <div className="status-notification-stack">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
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
                        transition={{
                            layout: {
                                type: 'spring',
                                damping: 30,
                                stiffness: 200,
                                mass: 0.8
                            },
                            opacity: { duration: 0.4 },
                            x: { type: 'spring', damping: 25, stiffness: 120 }
                        }}
                        className={`status-notification-item ${n.type}`}
                        style={{ borderLeftColor: n.color }}
                    >
                        <div className="notif-header">
                            <div className="notif-indicator">
                                {n.icon ? n.icon : <div className="notif-glow" style={{ backgroundColor: n.color }} />}
                                <span className="notif-label" style={{ color: n.color }}>{n.label}</span>
                            </div>
                        </div>
                        <p className="notif-description">{n.description}</p>
                        {n.insight && (
                            <div className="notif-insight">
                                <span className="insight-tag">RULE INSIGHT</span>
                                <p className="insight-text">{n.insight}</p>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
