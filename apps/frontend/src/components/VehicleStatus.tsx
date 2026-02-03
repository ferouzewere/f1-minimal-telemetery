import { Group } from '@visx/group';
import { Arc } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { useRaceStore } from '../store/useRaceStore';

interface VehicleStatusProps {
    size: number;
}

export const VehicleStatus: React.FC<VehicleStatusProps> = ({ size }) => {
    const focusedDriver = useRaceStore(state => state.focusedDriver);
    const totalLaps = useRaceStore(state => state.totalLaps);
    const driverFrames = useRaceStore(state => state.driverFrames);

    const currentFrame = focusedDriver ? driverFrames[focusedDriver] : null;

    // --- FUEL LOGIC (Simulated) ---
    // Start with 110kg. Burn linear to 0 at totalLaps.
    // Enhanced: Use lap + progress (dist) if possible, but lap is sufficient for mock.
    const maxFuel = 110;
    const currentLap = currentFrame?.lap || 1;
    // Avoid division by zero
    const progress = totalLaps > 0 ? (currentLap / totalLaps) : 0;
    const estimatedFuel = Math.max(0, maxFuel * (1 - progress));
    const fuelPercentage = (estimatedFuel / maxFuel) * 100;

    // --- TYRE LOGIC (Real) ---
    const compound = currentFrame?.compound || 'UNKNOWN';
    const tyreAge = currentFrame?.tyre_age || 0;

    // Compound Colors
    const getCompoundColor = (c: string) => {
        const up = c.toUpperCase();
        if (up.includes('SOFT')) return '#ef4444'; // Red
        if (up.includes('MEDIUM')) return '#eab308'; // Yellow
        if (up.includes('HARD')) return '#f8fafc'; // White
        if (up.includes('INTER')) return '#22c55e'; // Green
        if (up.includes('WET')) return '#3b82f6'; // Blue
        return '#64748b'; // Slate
    };
    const compoundColor = getCompoundColor(compound);

    // Dimensions
    const radius = size / 2;
    const strokeWidth = 6;
    const innerRadius = radius - strokeWidth;

    // Scale for Fuel Ring
    const fuelScale = scaleLinear({
        domain: [0, 100],
        range: [0, Math.PI * 2],
    });

    return (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
            <Group top={radius} left={radius}>
                {/* --- OUTER RING: FUEL --- */}
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={0}
                    endAngle={Math.PI * 2}
                    fill="transparent"
                    cornerRadius={2}
                />
                <Arc
                    innerRadius={innerRadius}
                    outerRadius={radius}
                    startAngle={0}
                    endAngle={fuelScale(fuelPercentage)}
                    fill={fuelPercentage < 10 ? "#ef4444" : "#22c55e"} // Red if low fuel
                    cornerRadius={2}
                    opacity={0.8}
                />

                {/* Fuel Labels */}
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
                    fontSize={12}
                    fontWeight={700}
                    fontFamily="JetBrains Mono"
                >
                    {estimatedFuel.toFixed(1)}kg
                </text>


                {/* --- CENTER: TYRE INFO --- */}
                {/* Big Tyre Icon/Circle */}
                <circle r={radius * 0.55} fill="transparent" stroke={compoundColor} strokeWidth={3} opacity={0.8} />

                {/* Compound Letter */}
                <text
                    y={-5}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={compoundColor}
                    fontSize={24}
                    fontWeight={900}
                    fontFamily="Outfit"
                    style={{ filter: `drop-shadow(0 0 8px ${compoundColor}40)` }}
                >
                    {compound.charAt(0).toUpperCase()}
                </text>

                {/* Tyre Age */}
                <text
                    y={18}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="JetBrains Mono"
                >
                    {tyreAge} LAPS
                </text>

            </Group>
        </svg>
    );
};
