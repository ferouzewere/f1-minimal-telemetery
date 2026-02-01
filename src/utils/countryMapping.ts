export const COUNTRY_CODES: Record<string, string> = {
    // Countries
    'bahrain': 'bh',
    'saudi arabia': 'sa',
    'australia': 'au',
    'japan': 'jp',
    'china': 'cn',
    'miami': 'us',
    'usa': 'us',
    'united states': 'us',
    'monaco': 'mc',
    'canada': 'ca',
    'spain': 'es',
    'austria': 'at',
    'uk': 'gb',
    'great britain': 'gb',
    'hungary': 'hu',
    'belgium': 'be',
    'netherlands': 'nl',
    'italy': 'it',
    'azerbaijan': 'az',
    'singapore': 'sg',
    'brazil': 'br',
    'mexico': 'mx',
    'qatar': 'qa',
    'abu dhabi': 'ae',
    'uae': 'ae',
    'portugal': 'pt',
    'france': 'fr',

    // City / Circuit / Area matches
    'jeddah': 'sa',
    'melbourne': 'au',
    'albert park': 'au',
    'suzuka': 'jp',
    'shanghai': 'cn',
    'monte carlo': 'mc',
    'montreal': 'ca',
    'barcelona': 'es',
    'catalunya': 'es',
    'spielberg': 'at',
    'silverstone': 'gb',
    'budapest': 'hu',
    'hungaroring': 'hu',
    'spa': 'be',
    'stavelot': 'be',
    'zandvoort': 'nl',
    'monza': 'it',
    'imola': 'it',
    'baku': 'az',
    'sao paulo': 'br',
    'interlagos': 'br',
    'mexico city': 'mx',
    'hermanos rodriguez': 'mx',
    'lusail': 'qa',
    'yas marina': 'ae',
    'sakhir': 'bh',
    'marina bay': 'sg',
    'austin': 'us',
    'americas': 'us',
    'las vegas': 'us',
    'miami gardens': 'us',
    'estoril': 'pt',
    'algarve': 'pt',
    'fuji': 'jp',
    'hockenheim': 'de',
    'nurburgring': 'de',
    'magny cours': 'fr',
    'paul ricard': 'fr',
    'sepang': 'my',
    'istanbul': 'tr',

    // Adjectives / Historic
    'british': 'gb',
    'japanese': 'jp',
    'chinese': 'cn',
    'french': 'fr',
    'portuguese': 'pt',
};

export const getFlagUrl = (location: string): string | null => {
    if (!location) return null;

    // Robust normalization: lowercase and remove accents (e.g., São Paulo -> sao paulo)
    const normalizedLocation = location
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // Check for direct match or partial match
    const entry = Object.entries(COUNTRY_CODES).find(([key]) =>
        normalizedLocation.includes(key)
    );

    const code = entry ? entry[1] : null;

    if (!code) return null;

    // Using local SVG assets
    return `/flags/${code}.svg`;
};
