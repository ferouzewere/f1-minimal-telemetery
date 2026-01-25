import React from 'react';
import { Group } from '@visx/group';
import { Arc } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { useRaceStore } from '../store/useRaceStore';

interface VehicleStatusProps {
    size: number;
}

export const VehicleStatus: React.FC<VehicleStatusProps> = ({ size }) => {
    const currentTime = useRaceStore(state => state.currentTime);

    // --- FUEL LOGIC (Mocked) ---
    // Sim: Start 100kg, burn 1.5kg per minute
    const maxFuel = 100;
    const estimatedFuel = Math.max(5, maxFuel - (currentTime / 60) * 1.5);
    const fuelPercentage = (estimatedFuel / maxFuel) * 100;

    // --- TYRE LOGIC (Mocked) ---
    const tyres = [
        { pos: 'FL', temp: 98 },
        { pos: 'FR', temp: 102 },
        { pos: 'RL', temp: 105 },
        { pos: 'RR', temp: 104 }
    ];

    const getTempColor = (t: number) => {
        if (t < 80) return '#3b82f6'; // Cold
        if (t < 100) return '#22c55e'; // Optimal
        if (t < 110) return '#eab308'; // Warm
        return '#ef4444'; // Hot
    };

    // Dimensions
    const radius = size / 2;
    const strokeWidth = 8;
    const innerRadius = radius - strokeWidth;

    // Fuel Scale (Arc)
    // 0 is Top. Let's do a 300 degree arc (-150 to +150) or full circle?
    // Let's do a full ring for style, or maybe start from bottom?
    // Let's match speedometer 'gap' style possibly? Or just full ring.
    // Speedometer is -135 to +135. Let's match that arc for consistency?
    // Actually user said "meter gauge".
    // Let's do a circular bar.
    const fuelScale = scaleLinear({
        domain: [0, 100],
        range: [0, Math.PI * 2], // Full circle
    });

    return (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
            <Group top={radius} left={radius}>
                {/* --- OUTER RING: FUEL --- */}
                {/* Background Track */}
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={0}
                    endAngle={Math.PI * 2}
                    fill="#1e293b"
                    opacity={0.3}
                    cornerRadius={2}
                />

                {/* Fuel Level */}
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={0}
                    endAngle={fuelScale(fuelPercentage)}
                    fill={fuelPercentage < 20 ? "#ef4444" : "#22c55e"}
                    cornerRadius={2}
                    opacity={0.8}
                />
                <text
                    y={-radius - 8}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="JetBrains Mono"
                >
                    FUEL
                </text>
                <text
                    y={radius + 15}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="JetBrains Mono"
                >
                    {estimatedFuel.toFixed(1)}KG
                </text>

                {/* --- INNER GRID: TYRES --- */}
                {/* Centered Grid */}
                <Group top={-15} left={-15}>
                    <foreignObject width={30} height={30} x={0} y={0} style={{ overflow: 'visible' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '4px',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '30px'
                        }}>
                            {tyres.map((t) => (
                                <div key={t.pos} style={{
                                    width: '12px',
                                    height: '16px',
                                    borderRadius: '3px',
                                    border: `1.5px solid ${getTempColor(t.temp)}`,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <span style={{ fontSize: '5px', color: '#fff', fontWeight: 800 }}>{t.pos[1]}</span>
                                    {/* Showing just L/R or F/R letter for tiny icon? Or nothing? */}
                                </div>
                            ))}
                        </div>
                    </foreignObject>
                </Group>

                {/* Label for Tyres center */}
                {/* Maybe too crowded. Let's just keep the colored boxes. */}

            </Group>
        </svg>
    );
};
