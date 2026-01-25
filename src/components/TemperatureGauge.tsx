import React from 'react';

interface TemperatureGaugeProps {
    height: number;
}

export const TemperatureGauge: React.FC<TemperatureGaugeProps> = ({ height }) => {
    // Mock temps
    const temps = {
        fl: 98,
        fr: 102,
        rl: 105,
        rr: 104
    };

    const getColor = (temp: number) => {
        if (temp < 80) return '#3b82f6'; // Cold (Blue)
        if (temp < 100) return '#22c55e'; // Optimal (Green)
        if (temp < 110) return '#eab308'; // Warm (Yellow)
        return '#ef4444'; // Hot (Red)
    };

    return (
        <div style={{
            height: height,
            width: '60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '10px 0'
        }}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', fontWeight: 800, color: '#94a3b8' }}>TYRES</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                {Object.entries(temps).map(([pos, temp]) => (
                    <div key={pos} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: '4px',
                        border: `1px solid ${getColor(temp)}`,
                        boxShadow: `0 0 5px ${getColor(temp)}40`
                    }}>
                        <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{pos}</span>
                        <span style={{ fontSize: '10px', color: '#f8fafc', fontWeight: 700 }}>{temp}°</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
