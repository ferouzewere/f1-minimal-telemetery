import React from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { motion } from 'framer-motion';

export const EnvironmentStats: React.FC = () => {
    const currentWeather = useRaceStore(state => state.currentWeather);

    if (!currentWeather) return null;

    return (
        <div className="environment-stats-pill">
            <div className="stat-group">
                <span className="label">AIR</span>
                <span className="value">{currentWeather.air_temp}°C</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-group">
                <span className="label">TRACK</span>
                <span className="value">{currentWeather.track_temp}°C</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-group">
                <span className="label">WIND</span>
                <span className="value">{currentWeather.wind_speed}km/h</span>
                <motion.div
                    className="wind-arrow"
                    animate={{ rotate: currentWeather.wind_direction }}
                    transition={{ type: 'spring', stiffness: 50 }}
                >
                    ↑
                </motion.div>
            </div>
            <div className="stat-divider" />
            <div className="stat-group">
                <span className="label">HUM</span>
                <span className="value">{currentWeather.humidity}%</span>
            </div>
        </div>
    );
};
