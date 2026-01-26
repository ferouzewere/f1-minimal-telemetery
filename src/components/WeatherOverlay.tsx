import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRaceStore } from '../store/useRaceStore';

export const WeatherOverlay: React.FC = () => {
    const currentWeather = useRaceStore(state => state.currentWeather);
    const isRaining = currentWeather?.rainfall || false;

    return (
        <AnimatePresence>
            {isRaining && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="weather-overlay"
                >
                    <div className="rain-container">
                        {[...Array(50)].map((_, i) => (
                            <div
                                key={i}
                                className="rain-drop"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${0.5 + Math.random() * 0.5}s`
                                }}
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
