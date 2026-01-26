export const COUNTRY_CODES: Record<string, string> = {
    'bahrain': 'bh',
    'saudi arabia': 'sa',
    'australia': 'au',
    'monaco': 'mc',
    'uk': 'gb',
    'belgium': 'be',
    'netherlands': 'nl',
    'italy': 'it',
    'sao paulo': 'br',
    'singapore': 'sg',
    'british': 'gb',
    'japanese': 'jp',
    'chinese': 'cn',
    'miami': 'us',
    'french': 'fr',
    'mexico city': 'mx',
};

export const getFlagUrl = (location: string): string | null => {
    if (!location) return null;

    const lowerLocation = location.toLowerCase();

    // Check for direct match or partial match (e.g., "Monte Carlo, Monaco")
    const entry = Object.entries(COUNTRY_CODES).find(([key]) => lowerLocation.includes(key));
    const code = entry ? entry[1] : null;

    if (!code) return null;

    // Using FlagCDN (h=height in px)
    return `https://flagcdn.com/w40/${code}.png`;
};
