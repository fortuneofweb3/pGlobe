/**
 * Latency region utilities for calculating latency from different server regions
 * 
 * SERVER LOCATION: US East (New York)
 * All server-side latency measurements are taken from US East region.
 * Client latency is calculated by adjusting server latency based on geographic distance.
 */

// Server location - where all latency measurements are taken from
export const SERVER_REGION_ID = 'us-east';

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
  {
    id: 'africa-south',
    name: 'Africa South',
    location: {
      country: 'South Africa',
      city: 'Johannesburg',
      lat: -26.2041,
      lon: 28.0473,
    },
  },
  {
    id: 'africa-west',
    name: 'Africa West',
    location: {
      country: 'Nigeria',
      city: 'Lagos',
      lat: 6.5244,
      lon: 3.3792,
    },
  },
];

/**
 * Get typical RTT latency between region centers (in milliseconds)
 * Based on real-world measurements from cloud providers and network infrastructure
 * These are typical values for well-connected regions via major internet backbones
 */
function getTypicalRegionLatency(fromRegion: string, toRegion: string): number {
  // Lookup table of typical RTT latencies between region centers (ms)
  // Values based on real-world measurements from AWS, GCP, Azure inter-region latency
  // Same region = 0 (no inter-region travel)
  const latencyTable: Record<string, Record<string, number>> = {
    'us-east': {
      'us-east': 0,
      'us-west': 70,
      'eu-west': 85,
      'eu-north': 90,
      'asia-east': 200,
      'asia-north': 150,
      'africa-south': 250,
      'africa-west': 220,
    },
    'us-west': {
      'us-east': 70,
      'us-west': 0,
      'eu-west': 150,
      'eu-north': 160,
      'asia-east': 140,
      'asia-north': 110,
      'africa-south': 280,
      'africa-west': 260,
    },
    'eu-west': {
      'us-east': 85,
      'us-west': 150,
      'eu-west': 0,
      'eu-north': 15,
      'asia-east': 180,
      'asia-north': 220,
      'africa-south': 180,
      'africa-west': 160,
    },
    'eu-north': {
      'us-east': 90,
      'us-west': 160,
      'eu-west': 15,
      'eu-north': 0,
      'asia-east': 200,
      'asia-north': 240,
      'africa-south': 190,
      'africa-west': 170,
    },
    'asia-east': {
      'us-east': 200,
      'us-west': 140,
      'eu-west': 180,
      'eu-north': 200,
      'asia-east': 0,
      'asia-north': 50,
      'africa-south': 220,
      'africa-west': 200,
    },
    'asia-north': {
      'us-east': 150,
      'us-west': 110,
      'eu-west': 220,
      'eu-north': 240,
      'asia-east': 50,
      'asia-north': 0,
      'africa-south': 240,
      'africa-west': 220,
    },
    'africa-south': {
      'us-east': 250,
      'us-west': 280,
      'eu-west': 180,
      'eu-north': 190,
      'asia-east': 220,
      'asia-north': 240,
      'africa-south': 0,
      'africa-west': 80, // Same continent, good connectivity
    },
    'africa-west': {
      'us-east': 220,
      'us-west': 260,
      'eu-west': 160,
      'eu-north': 170,
      'asia-east': 200,
      'asia-north': 220,
      'africa-south': 80, // Same continent, good connectivity
      'africa-west': 0,
    },
  };
  
  return latencyTable[fromRegion]?.[toRegion] ?? 200; // Default fallback
}

/**
 * Calculate one-way network latency estimate based on geographic distance
 * This estimates only the network portion (not including node processing)
 * Used as fallback when region multipliers aren't available
 */
function calculateOneWayNetworkLatency(
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

  // One-way network latency estimation:
  // - Speed of light in fiber: ~200,000 km/s (2/3 of vacuum speed)
  // - Distance factor: ~1ms per 200km (one-way)
  // - Additional routing overhead: ~10-25ms depending on distance (one-way)
  const distanceLatency = (distanceKm / 200) * 1; // ~1ms per 200km one-way
  const routingOverhead = distanceKm < 1000 ? 10 : distanceKm < 5000 ? 15 : 25;
  
  return Math.round(distanceLatency + routingOverhead);
}

/**
 * Adjust server RTT latency for a different region
 * 
 * CORRECT CALCULATION:
 * serverLatency = RTT from server region to node
 *                = 2 × network_server_to_node + node_processing_time
 * 
 * We want: RTT_user_to_node = 2 × network_user_to_node + node_processing_time
 * 
 * Since we don't know node_processing_time separately, we estimate it:
 * - Assume node_processing_time is small (~5-10ms) and relatively constant
 * - Extract network portion: network_server = (serverLatency - estimated_processing) / 2
 * - Calculate network_user based on distance ratio
 * - Reconstruct: RTT_user = 2 × network_user + estimated_processing
 * 
 * @param serverLatency - RTT measured from server (includes network both ways + node processing)
 * @param nodeLocation - Node's geographic location
 * @param fromRegion - Region where server latency was measured
 * @param toRegion - Target region (user's region) to estimate latency for
 */
/**
 * Adjust server RTT latency for a different region
 * 
 * IMPORTANT: We measure latency TO proxy endpoints (rpc1.pchednode.com, etc.), not directly to nodes.
 * The proxy endpoints are likely in US East and route requests to nodes.
 * 
 * Actual path: Server → Proxy → Node
 * Measured: Server → Proxy (what we store as serverLatency)
 * User path: User → Proxy → Node
 * 
 * Calculation:
 * 1. Proxy is likely in US East (proxyRegion = 'us-east')
 * 2. Server → Proxy = serverLatency (what we measured)
 * 3. User → Proxy = lookup(toRegion → proxyRegion)
 * 4. Proxy → Node = estimated from serverLatency, accounting for Server → Proxy distance
 * 
 * Since Proxy → Node is the same for all nodes (same proxy), we estimate:
 * - Extract Server → Proxy portion from serverLatency
 * - Estimate Proxy → Node (assume it's relatively constant, ~50-100ms for proxy routing)
 * - User → Node ≈ User → Proxy + Proxy → Node
 * 
 * @param serverLatency - RTT measured from server TO proxy endpoint (not directly to node)
 * @param nodeLocation - Node's geographic location (for fine-tuning)
 * @param fromRegion - Region where server is located (where measurement was taken from)
 * @param toRegion - Target region (user's region) to estimate latency for
 */
export function adjustLatencyForRegion(
  serverLatency: number,
  nodeLocation: { lat?: number; lon?: number; country?: string } | null,
  fromRegion: string = SERVER_REGION_ID,
  toRegion: string
): number {
  // IMPORTANT: If user selects the same region as where server measured from,
  // use the server's measurement directly (it's the ground truth for that region)
  if (fromRegion === toRegion) {
    return serverLatency;
  }

  // Proxy endpoints are likely in US East
  const PROXY_REGION = 'us-east';
  
  // Step 1: Get User → Proxy latency (user's region to proxy region)
  const userToProxyLatency = getTypicalRegionLatency(toRegion, PROXY_REGION);
  const proxyToUserLatency = getTypicalRegionLatency(PROXY_REGION, toRegion);
  const avgUserToProxy = (userToProxyLatency + proxyToUserLatency) / 2;
  
  // Step 2: Get Server → Proxy latency (server's region to proxy region)
  const serverToProxyLatency = getTypicalRegionLatency(fromRegion, PROXY_REGION);
  const proxyToServerLatency = getTypicalRegionLatency(PROXY_REGION, fromRegion);
  const avgServerToProxy = (serverToProxyLatency + proxyToServerLatency) / 2;
  
  // Step 3: Estimate Proxy → Node latency
  // The serverLatency we measured includes: Server → Proxy + Proxy → Node (routing)
  // We can estimate Proxy → Node by subtracting the Server → Proxy portion
  // But since we don't know the exact breakdown, we use a conservative estimate
  // Typical proxy routing adds 50-150ms depending on node location
  const estimatedProxyToNode = Math.max(50, Math.min(150, serverLatency - avgServerToProxy));
  
  // Step 4: Calculate User → Node latency
  // User → Node = User → Proxy + Proxy → Node
  const userToNodeLatency = avgUserToProxy + estimatedProxyToNode;
  
  // Fine-tuning: if we know node location, adjust based on node's distance to user vs proxy
  if (nodeLocation && nodeLocation.lat && nodeLocation.lon) {
    const toRegionData = LATENCY_REGIONS.find(r => r.id === toRegion);
    const proxyRegionData = LATENCY_REGIONS.find(r => r.id === PROXY_REGION);
    
    if (toRegionData && proxyRegionData) {
      const nodeToUserDistance = calculateOneWayNetworkLatency(
        nodeLocation.lat,
        nodeLocation.lon,
        toRegionData.location.lat,
        toRegionData.location.lon
      );
      
      const nodeToProxyDistance = calculateOneWayNetworkLatency(
        nodeLocation.lat,
        nodeLocation.lon,
        proxyRegionData.location.lat,
        proxyRegionData.location.lon
      );
      
      // If node is closer to user than to proxy, reduce latency slightly
      // If node is farther from user than proxy, increase latency slightly
      const distanceDiff = nodeToUserDistance - nodeToProxyDistance;
      const fineTuneAdjustment = distanceDiff * 0.3; // Small adjustment factor
      
      return Math.round(Math.max(10, userToNodeLatency + fineTuneAdjustment));
    }
  }
  
  return Math.round(Math.max(10, userToNodeLatency));
}

/**
 * Get region by ID
 */
export function getRegionById(id: string): LatencyRegion | undefined {
  return LATENCY_REGIONS.find(r => r.id === id);
}

