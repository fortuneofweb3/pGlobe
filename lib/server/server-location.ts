/**
 * Server location detection and tracking
 * Detects where the server is running from (local dev vs production)
 */

import { detectUserRegion, type UserLocation } from '../utils/user-region';
import { LATENCY_REGIONS, SERVER_REGION_ID, type LatencyRegion } from '../utils/latency-regions';

let cachedServerLocation: UserLocation | null = null;
let cachedServerRegion: LatencyRegion | null = null;

/**
 * Detect server's geographic location
 * Uses IP geolocation API to determine where the server is running
 */
export async function detectServerLocation(): Promise<UserLocation | null> {
  // Return cached value if available
  if (cachedServerLocation) {
    return cachedServerLocation;
  }

  try {
    // Get server's IP address
    const ipResponse = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!ipResponse.ok) {
      console.warn('[ServerLocation] Failed to get server IP');
      return null;
    }
    
    const ipData = await ipResponse.json();
    const serverIp = ipData.ip;
    
    if (!serverIp) {
      console.warn('[ServerLocation] No IP in response');
      return null;
    }

    // Use ip-api.com to get location (free tier, no API key needed)
    const geoResponse = await fetch(`http://ip-api.com/json/${serverIp}?fields=status,country,city,lat,lon`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!geoResponse.ok) {
      console.warn('[ServerLocation] Geo API failed:', geoResponse.status);
      return null;
    }
    
    const geoData = await geoResponse.json();
    if (geoData.status !== 'success' || !geoData.lat || !geoData.lon) {
      console.warn('[ServerLocation] Invalid geo data:', geoData);
      return null;
    }

    const location: UserLocation = {
      lat: geoData.lat,
      lon: geoData.lon,
      country: geoData.country,
      city: geoData.city,
    };

    // Cache the result
    cachedServerLocation = location;
    console.log(`[ServerLocation] ✅ Detected server location: ${geoData.city}, ${geoData.country} (${geoData.lat}, ${geoData.lon})`);
    
    return location;
  } catch (error) {
    console.error('[ServerLocation] Error detecting server location:', error);
    return null;
  }
}

/**
 * Get server's latency region
 * Returns the closest latency region to the server's location
 */
export async function getServerRegion(): Promise<LatencyRegion> {
  // Return cached value if available
  if (cachedServerRegion) {
    return cachedServerRegion;
  }

  const location = await detectServerLocation();
  
  if (!location) {
    // Default to US East if we can't detect
    console.warn('[ServerLocation] Could not detect server location, defaulting to US East');
    const defaultRegion = LATENCY_REGIONS.find(r => r.id === SERVER_REGION_ID)!;
    cachedServerRegion = defaultRegion;
    return defaultRegion;
  }

  // Detect region from location
  const region = detectUserRegion(location);
  cachedServerRegion = region;
  console.log(`[ServerLocation] ✅ Server region: ${region.name} (${region.id})`);
  
  return region;
}

/**
 * Get server region ID (for storage in database)
 */
export async function getServerRegionId(): Promise<string> {
  const region = await getServerRegion();
  return region.id;
}

