import React from 'react';
import { useRaceStore } from '../store/useRaceStore';

interface FuelGaugeProps {
    height: number;
}

export const FuelGauge: React.FC<FuelGaugeProps> = ({ height }) => {
    // Mock fuel data for now, or derive from telemetry if available (usually not valid for public telemetry)
    // We'll simulate fuel burn based on time
    const currentTime = useRaceStore(state => state.currentTime);

    // Sim: Start 100kg, burn 1.5kg per minute?
    // Just simple linear degradation for visuals
    const maxFuel = 100;
    const estimatedFuel = Math.max(5, maxFuel - (currentTime / 60) * 1.5);
    const percentage = (estimatedFuel / maxFuel) * 100;

    return (
        <div style={{
            height: height,
            width: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
        }}>
            <div style={{
                flex: 1,
                width: '12px',
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${percentage}%`,
                    background: 'linear-gradient(to top, #ef4444 0%, #eab308 20%, #22c55e 100%)',
                    transition: 'height 1s linear'
                }} />

                {/* Tick marks */}
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        bottom: `${i * 25}%`,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.3)'
                    }} />
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#94a3b8'
                }}>FUEL</span>
                <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#f8fafc'
                }}>{Math.round(estimatedFuel)}kg</span>
            </div>
        </div>
    );
};
