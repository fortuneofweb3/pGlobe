/**
 * Latency region utilities for calculating latency from different server regions
 */

export interface LatencyRegion {
  id: string;
  name: string;
  location: {
    country: string;
    city: string;
    lat: number;
    lon: number;
  };
}

export const LATENCY_REGIONS: LatencyRegion[] = [
  {
    id: 'us-east',
    name: 'US East',
    location: {
      country: 'United States',
      city: 'New York',
      lat: 40.7128,
      lon: -74.0060,
    },
  },
  {
    id: 'us-west',
    name: 'US West',
    location: {
      country: 'United States',
      city: 'San Francisco',
      lat: 37.7749,
      lon: -122.4194,
    },
  },
  {
    id: 'eu-west',
    name: 'EU West',
    location: {
      country: 'Germany',
      city: 'Frankfurt',
      lat: 50.1109,
      lon: 8.6821,
    },
  },
  {
    id: 'eu-north',
    name: 'EU North',
    location: {
      country: 'Netherlands',
      city: 'Amsterdam',
      lat: 52.3676,
      lon: 4.9041,
    },
  },
  {
    id: 'asia-east',
    name: 'Asia East',
    location: {
      country: 'Singapore',
      city: 'Singapore',
      lat: 1.3521,
      lon: 103.8198,
    },
  },
  {
    id: 'asia-north',
    name: 'Asia North',
    location: {
      country: 'Japan',
      city: 'Tokyo',
      lat: 35.6762,
      lon: 139.6503,
    },
  },
];

/**
 * Calculate approximate latency based on geographic distance
 * This is a rough estimation - actual latency depends on network routes, not just distance
 */
function calculateDistanceLatency(
  nodeLat: number,
  nodeLon: number,
  serverLat: number,
  serverLon: number
): number {
  // Haversine formula to calculate distance in km
  const R = 6371; // Earth's radius in km
  const dLat = (serverLat - nodeLat) * Math.PI / 180;
  const dLon = (serverLon - nodeLon) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nodeLat * Math.PI / 180) * Math.cos(serverLat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Rough latency estimation:
  // - Base latency: 5ms (processing time)
  // - Speed of light in fiber: ~200,000 km/s (2/3 of vacuum speed)
  // - Distance factor: ~1ms per 200km
  // - Additional routing overhead: ~20-50ms depending on distance
  const baseLatency = 5;
  const distanceLatency = (distanceKm / 200) * 1; // ~1ms per 200km
  const routingOverhead = distanceKm < 1000 ? 20 : distanceKm < 5000 ? 30 : 50;
  
  return Math.round(baseLatency + distanceLatency + routingOverhead);
}

/**
 * Adjust server latency for a different region
 * Uses geographic distance to estimate latency from different server locations
 */
export function adjustLatencyForRegion(
  serverLatency: number,
  nodeLocation: { lat?: number; lon?: number; country?: string } | null,
  fromRegion: string,
  toRegion: string
): number {
  if (!nodeLocation || !nodeLocation.lat || !nodeLocation.lon) {
    // If we don't have node location, use a rough multiplier based on region distance
    const regionMultipliers: Record<string, Record<string, number>> = {
      'us-east': {
        'us-west': 1.3,
        'eu-west': 1.8,
        'eu-north': 1.9,
        'asia-east': 2.5,
        'asia-north': 2.7,
      },
      'us-west': {
        'us-east': 1.3,
        'eu-west': 2.0,
        'eu-north': 2.1,
        'asia-east': 1.4,
        'asia-north': 1.6,
      },
      'eu-west': {
        'us-east': 1.8,
        'us-west': 2.0,
        'eu-north': 1.1,
        'asia-east': 2.2,
        'asia-north': 2.4,
      },
      'eu-north': {
        'us-east': 1.9,
        'us-west': 2.1,
        'eu-west': 1.1,
        'asia-east': 2.3,
        'asia-north': 2.5,
      },
      'asia-east': {
        'us-east': 2.5,
        'us-west': 1.4,
        'eu-west': 2.2,
        'eu-north': 2.3,
        'asia-north': 1.2,
      },
      'asia-north': {
        'us-east': 2.7,
        'us-west': 1.6,
        'eu-west': 2.4,
        'eu-north': 2.5,
        'asia-east': 1.2,
      },
    };
    
    const multiplier = regionMultipliers[fromRegion]?.[toRegion] || 1.0;
    return Math.round(serverLatency * multiplier);
  }

  // Use geographic calculation
  const fromRegionData = LATENCY_REGIONS.find(r => r.id === fromRegion);
  const toRegionData = LATENCY_REGIONS.find(r => r.id === toRegion);
  
  if (!fromRegionData || !toRegionData) {
    return serverLatency; // Fallback to original
  }

  // Calculate latency from new region
  const newLatency = calculateDistanceLatency(
    nodeLocation.lat!,
    nodeLocation.lon!,
    toRegionData.location.lat,
    toRegionData.location.lon
  );

  return newLatency;
}

/**
 * Get region by ID
 */
export function getRegionById(id: string): LatencyRegion | undefined {
  return LATENCY_REGIONS.find(r => r.id === id);
}

