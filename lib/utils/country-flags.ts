/**
 * Country flag utilities
 * Converts country codes to flag emojis
 */

/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji
 * @param countryCode - Two-letter country code (e.g., "US", "GB", "DE")
 * @returns Flag emoji string or empty string if invalid
 */
export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  // Convert country code to uppercase
  const code = countryCode.toUpperCase();
  
  // Convert each letter to regional indicator symbol
  // A = 0x1F1E6 (REGIONAL INDICATOR SYMBOL LETTER A)
  const flag = code
    .split('')
    .map(char => String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65))
    .join('');

  return flag || '';
}

/**
 * Get flag emoji for a country name or code
 * @param country - Country name or code
 * @param countryCode - Optional country code (takes precedence)
 * @returns Flag emoji string
 */
export function getFlagForCountry(
  country: string | null | undefined,
  countryCode?: string | null | undefined
): string {
  // Prefer country code if available
  if (countryCode) {
    const flag = getCountryFlag(countryCode);
    if (flag) return flag;
  }

  // Fallback: try to extract code from country name or use common mappings
  if (!country) return '';

  // Common country name to code mappings for countries that might not have codes
  const countryToCode: Record<string, string> = {
    'United States': 'US',
    'United Kingdom': 'GB',
    'United States of America': 'US',
    'United Arab Emirates': 'AE',
    'Russian Federation': 'RU',
  };

  const code = countryToCode[country] || country.substring(0, 2).toUpperCase();
  return getCountryFlag(code);
}


