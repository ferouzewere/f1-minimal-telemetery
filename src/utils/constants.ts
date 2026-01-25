import type { CircuitMetadata } from '../store/useRaceStore';

export type Sector = 1 | 2 | 3;

/**
 * Determines current sector based on lap distance and circuit metadata
 */
export const getSector = (dist: number, metadata: CircuitMetadata | null): Sector => {
    const lapLength = metadata?.lapLength || 3337;
    const s1 = metadata?.sectors.s1_end || 800;
    const s2 = metadata?.sectors.s2_end || 1800;

    const lapDist = dist % lapLength;
    if (lapDist < s1) return 1;
    if (lapDist < s2) return 2;
    return 3;
};
