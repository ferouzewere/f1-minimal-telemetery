import React from 'react';

interface CircuitOutlineProps {
    circuitId?: string;
    className?: string;
    dynamicPath?: string;
}

/**
 * Renders a high-fidelity circuit outline.
 * Prefers the dynamicPath (from manifest/telemetry) but can fall back if needed.
 */
export const CircuitOutline: React.FC<CircuitOutlineProps> = ({ className = "", dynamicPath }) => {
    const d = dynamicPath;

    if (!d) {
        return (
            <div className={`${className} flex items-center justify-center text-slate-500`} style={{ fontSize: '10px' }}>
                [NO MAP DATA]
            </div>
        );
    }

    return (
        <svg
            width="100%"
            height="100%"
            viewBox="0 0 1000 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            preserveAspectRatio="xMidYMid meet"
        >
            <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={25}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
            />
        </svg>
    );
};
