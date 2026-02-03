import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';

export const BackgroundJobIndicator: React.FC = () => {
    const activeJobs = useRaceStore(state => state.activeJobs);
    const removeJob = useRaceStore(state => state.removeJob);

    // For this implementation, we'll show the most recent job
    const job = activeJobs.length > 0 ? activeJobs[activeJobs.length - 1] : null;

    // Auto-remove completed jobs after a delay, but keep failed ones longer
    useEffect(() => {
        if (!job) return;

        if (job.status === 'completed') {
            const timer = setTimeout(() => {
                removeJob(job.id);
            }, 3000);
            return () => clearTimeout(timer);
        } else if (job.status === 'failed') {
            const timer = setTimeout(() => {
                removeJob(job.id);
            }, 8000); // Failures stay longer
            return () => clearTimeout(timer);
        }
    }, [job, removeJob]);

    const getStatusColor = () => {
        if (job?.status === 'failed') return '#ef4444';
        if (job?.status === 'completed') return '#10b981';
        return '#3b82f6';
    };

    const statusColor = getStatusColor();

    return (
        <AnimatePresence>
            {job && (
                <motion.div
                    className="background-job-indicator"
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    style={{
                        height: '2.5rem',
                        background: job.status === 'failed' ? 'rgba(28, 10, 10, 0.85)' : 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${job.status === 'failed' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                        borderRadius: '0.75rem',
                        padding: '0 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginLeft: '-0.75rem',
                        zIndex: 100,
                        position: 'relative',
                        boxShadow: job.status === 'failed' ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '120px' }}>
                        <div style={{
                            fontSize: '0.65rem',
                            color: job.status === 'failed' ? '#f87171' : '#94a3b8',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            {job.status === 'failed' ? 'Sync Failed' : 'Syncing Mission'}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: '#fff',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '150px'
                        }}>
                            {job.status === 'failed' ? job.message : job.name}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <div style={{
                            height: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '2px',
                            flex: 1,
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${job.progress}%` }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    height: '100%',
                                    background: statusColor,
                                    boxShadow: `0 0 10px ${statusColor}`
                                }}
                            />
                        </div>
                        <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: statusColor,
                            minWidth: '40px',
                            textAlign: 'right'
                        }}>
                            {job.status === 'failed' ? 'ERR' : `${Math.round(job.progress)}%`}
                        </span>
                    </div>

                    {job.status === 'completed' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                                width: '1.25rem',
                                height: '1.25rem',
                                background: '#10b981',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px #10b981'
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </motion.div>
                    )}

                    {job.status === 'failed' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                                width: '1.25rem',
                                height: '1.25rem',
                                background: '#ef4444',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px #ef4444'
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
