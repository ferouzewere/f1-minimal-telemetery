export const MONACO_SECTORS = {
    S1_END: 800,
    S2_END: 1800,
    LAP_LENGTH: 3337
};

export type Sector = 1 | 2 | 3;

/**
 * Determines current sector based on lap distance
 */
export const getSector = (dist: number): Sector => {
    const lapDist = dist % MONACO_SECTORS.LAP_LENGTH;
    if (lapDist < MONACO_SECTORS.S1_END) return 1;
    if (lapDist < MONACO_SECTORS.S2_END) return 2;
    return 3;
};
