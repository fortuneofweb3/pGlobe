/**
 * User region detection utilities
 * Detects user's geographic region to adjust server latency calculations
 */

import { LATENCY_REGIONS, type LatencyRegion } from './latency-regions';

export interface UserLocation {
  lat: number;
  lon: number;
  country?: string;
  city?: string;
  countryCode?: string; // ISO country code (e.g., 'ZA', 'NG')
}

/**
 * Detect user's region based on their location
 * Returns the closest latency region
 * Uses country code as a fallback/validation if available
 */
export function detectUserRegion(location: UserLocation | null): LatencyRegion {
  if (!location || !location.lat || !location.lon) {
    // Default to US East if we can't detect location
    return LATENCY_REGIONS.find(r => r.id === 'us-east')!;
  }

  // Country-based region mapping (fallback/validation)
  const countryRegionMap: Record<string, string> = {
    // Africa
    'ZA': 'africa-south', // South Africa
    'NG': 'africa-west', // Nigeria
    'KE': 'africa-south', // Kenya
    'EG': 'africa-west', // Egypt
    'GH': 'africa-west', // Ghana
    'TZ': 'africa-south', // Tanzania
    'ET': 'africa-south', // Ethiopia
    'UG': 'africa-south', // Uganda
    'DZ': 'africa-west', // Algeria
    'MA': 'africa-west', // Morocco
    'TN': 'africa-west', // Tunisia
    'AO': 'africa-south', // Angola
    'MZ': 'africa-south', // Mozambique
    'ZM': 'africa-south', // Zambia
    'ZW': 'africa-south', // Zimbabwe
    'BW': 'africa-south', // Botswana
    'NA': 'africa-south', // Namibia
    'SN': 'africa-west', // Senegal
    'CI': 'africa-west', // Côte d'Ivoire
    'CM': 'africa-west', // Cameroon
  };

  // Find closest region based on geographic distance
  let closestRegion = LATENCY_REGIONS[0];
  let minDistance = Infinity;

  for (const region of LATENCY_REGIONS) {
    const distance = calculateDistance(
      location.lat,
      location.lon,
      region.location.lat,
      region.location.lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestRegion = region;
    }
  }

  // If country suggests an African region and we're detecting a non-African region,
  // check if an African region is reasonably close
  // Use countryCode directly if available, otherwise try to get it from country name
  const countryCode = location.countryCode || (location.country ? getCountryCode(location.country) : null);
  if (countryCode && countryRegionMap[countryCode]) {
    const countryBasedRegion = LATENCY_REGIONS.find(r => r.id === countryRegionMap[countryCode]);
    if (countryBasedRegion && countryBasedRegion.id !== closestRegion.id) {
      const countryDistance = calculateDistance(
        location.lat,
        location.lon,
        countryBasedRegion.location.lat,
        countryBasedRegion.location.lon
      );
      // If country-based region is within reasonable distance (< 3000km), prefer it
      // This helps when IP geolocation is slightly off but country is correct
      // Also prefer it if the closest region is very far (> 5000km) and country region is closer
      if (countryDistance < 3000 && (minDistance > 2000 || countryDistance < minDistance * 1.5 || (minDistance > 5000 && countryDistance < minDistance))) {
        return countryBasedRegion;
      }
    }
  }

  return closestRegion;
}

/**
 * Get country code from country name (comprehensive mapping)
 */
function getCountryCode(countryName: string): string | null {
  const countryMap: Record<string, string> = {
    // Southern Africa
    'South Africa': 'ZA',
    'Botswana': 'BW',
    'Lesotho': 'LS',
    'Eswatini': 'SZ',
    'Namibia': 'NA',
    'Zimbabwe': 'ZW',
    'Zambia': 'ZM',
    'Malawi': 'MW',
    'Mozambique': 'MZ',
    'Madagascar': 'MG',
    'Mauritius': 'MU',
    'Seychelles': 'SC',
    'Angola': 'AO',
    'Tanzania': 'TZ',
    'Kenya': 'KE',
    'Uganda': 'UG',
    'Rwanda': 'RW',
    'Burundi': 'BI',
    'Ethiopia': 'ET',
    'Eritrea': 'ER',
    'Djibouti': 'DJ',
    'Somalia': 'SO',
    'South Sudan': 'SS',
    
    // West Africa
    'Nigeria': 'NG',
    'Ghana': 'GH',
    'Senegal': 'SN',
    'Côte d\'Ivoire': 'CI',
    'Ivory Coast': 'CI',
    'Cameroon': 'CM',
    'Niger': 'NE',
    'Burkina Faso': 'BF',
    'Mali': 'ML',
    'Chad': 'TD',
    'Guinea': 'GN',
    'Guinea-Bissau': 'GW',
    'Sierra Leone': 'SL',
    'Liberia': 'LR',
    'Togo': 'TG',
    'Benin': 'BJ',
    'Mauritania': 'MR',
    'Equatorial Guinea': 'GQ',
    'Gabon': 'GA',
    'Republic of the Congo': 'CG',
    'Congo': 'CG',
    'Democratic Republic of the Congo': 'CD',
    'DRC': 'CD',
    'Central African Republic': 'CF',
    'São Tomé and Príncipe': 'ST',
    'Cape Verde': 'CV',
    'Gambia': 'GM',
    
    // North Africa
    'Egypt': 'EG',
    'Libya': 'LY',
    'Tunisia': 'TN',
    'Algeria': 'DZ',
    'Morocco': 'MA',
    'Sudan': 'SD',
  };
  
  // Try exact match first
  if (countryMap[countryName]) {
    return countryMap[countryName];
  }
  
  // Try case-insensitive match
  const lowerName = countryName.toLowerCase();
  for (const [key, value] of Object.entries(countryMap)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  return null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get user's location from browser geolocation API
 */
export async function getUserLocation(): Promise<UserLocation | null> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        // User denied or error - fall back to IP-based detection
        resolve(null);
      },
      {
        timeout: 5000,
        maximumAge: 3600000, // Cache for 1 hour
      }
    );
  });
}

/**
 * Get user's location from IP address (via API)
 * Uses the same method as scan page - gets IP from ipify.org, then uses /api/geo
 */
export async function getUserLocationFromIP(): Promise<UserLocation | null> {
  try {
    // First get user's IP address (same as scan page)
    const ipResponse = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!ipResponse.ok) {
      return null;
    }
    
    const ipData = await ipResponse.json();
    const userIp = ipData.ip;
    
    if (!userIp) {
      return null;
    }

    // Then use our geo API to get location (same as scan page)
    // Increased timeout to 20 seconds - geo API can be slow, especially on first request
    const geoResponse = await fetch(`/api/geo?ip=${encodeURIComponent(userIp)}`, {
      signal: AbortSignal.timeout(20000),
    });
    
    if (!geoResponse.ok) {
      return null;
    }
    
    const geoData = await geoResponse.json();
    if (geoData.error) {
      return null;
    }
    
    if (!geoData.lat || !geoData.lon) {
      return null;
    }

    const location = {
      lat: geoData.lat,
      lon: geoData.lon,
      country: geoData.country,
      city: geoData.city,
      countryCode: geoData.countryCode,
    };
    
    return location;
  } catch (error) {
    return null;
  }
}

