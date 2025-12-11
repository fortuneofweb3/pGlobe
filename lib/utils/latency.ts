/**
 * Enhanced Latency utilities with relative ranking, client-side measurement, and geographic context
 */

import { PNode } from '../types/pnode';

export interface LatencyRanking {
  percentile: number; // 0-100, lower is better
  rank: 'excellent' | 'good' | 'average' | 'slow' | 'very-slow';
  label: string;
  color: string;
}

export interface LatencyMeasurement {
  serverLatency: number | null; // Measured from server
  clientLatency: number | null; // Measured from user's browser (if available)
  source: 'server' | 'client' | 'both';
}

export interface LatencyContext {
  nodeRegion?: string;
  expectedRanges: {
    sameRegion: string;
    nearbyRegion: string;
    farRegion: string;
  };
}

/**
 * Calculate latency percentile ranking for a node
 * Lower latency = lower percentile (better)
 */
export function calculateLatencyRanking(
  nodeLatency: number | null | undefined,
  allNodes: PNode[]
): LatencyRanking | null {
  if (nodeLatency === null || nodeLatency === undefined) {
    return null;
  }

  // Get all nodes with valid latency
  const nodesWithLatency = allNodes
    .filter(n => n.latency !== undefined && n.latency !== null && n.latency > 0)
    .map(n => n.latency!)
    .sort((a, b) => a - b);

  if (nodesWithLatency.length === 0) {
    return null;
  }

  // Calculate percentile (what percentage of nodes have higher latency)
  const nodesWithHigherLatency = nodesWithLatency.filter(l => l > nodeLatency).length;
  const percentile = (nodesWithHigherLatency / nodesWithLatency.length) * 100;

  // Determine rank based on percentile
  let rank: LatencyRanking['rank'];
  let label: string;
  let color: string;

  if (percentile <= 10) {
    rank = 'excellent';
    label = 'Top 10%';
    color = 'text-green-500';
  } else if (percentile <= 25) {
    rank = 'good';
    label = 'Top 25%';
    color = 'text-green-400';
  } else if (percentile <= 50) {
    rank = 'average';
    label = 'Average';
    color = 'text-yellow-500';
  } else if (percentile <= 75) {
    rank = 'slow';
    label = 'Slow';
    color = 'text-orange-500';
  } else {
    rank = 'very-slow';
    label = 'Very Slow';
    color = 'text-red-500';
  }

  return {
    percentile: Math.round(percentile * 10) / 10,
    rank,
    label,
    color,
  };
}

/**
 * Get geographic context for latency interpretation
 */
export function getLatencyContext(node: PNode): LatencyContext | null {
  const country = node.locationData?.country;
  if (!country) return null;

  // Rough regional grouping
  const regions: Record<string, string> = {
    // North America
    'United States': 'North America',
    'Canada': 'North America',
    'Mexico': 'North America',
    // Europe
    'Germany': 'Europe',
    'France': 'Europe',
    'United Kingdom': 'Europe',
    'Netherlands': 'Europe',
    'Poland': 'Europe',
    'Spain': 'Europe',
    'Italy': 'Europe',
    // Asia
    'Japan': 'Asia',
    'Singapore': 'Asia',
    'South Korea': 'Asia',
    'China': 'Asia',
    'India': 'Asia',
    // Add more as needed
  };

  const nodeRegion = regions[country] || 'Unknown';

  return {
    nodeRegion,
    expectedRanges: {
      sameRegion: '10-50ms',
      nearbyRegion: '50-150ms',
      farRegion: '150-300ms',
    },
  };
}

/**
 * Measure latency from client-side (browser)
 * Only works if node's pRPC is publicly accessible and allows CORS
 * Note: Most nodes keep pRPC private (localhost-only), so this will fail for most nodes
 */
export async function measureClientLatency(node: PNode): Promise<number | null> {
  if (!node.address) return null;

  const addressParts = node.address.split(':');
  const ip = addressParts[0];
  const port = node.rpcPort?.toString() || addressParts[1] || '6000';

  if (!ip) return null;

  try {
    const startTime = performance.now();
    
    // Try HTTPS first (if page is HTTPS), then HTTP
    // Note: This will fail for most nodes due to:
    // 1. CORS restrictions (nodes don't allow cross-origin requests)
    // 2. Mixed content (HTTPS pages can't call HTTP endpoints)
    // 3. Localhost-only pRPC (most common)
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const url = `${protocol}://${ip}:${port}/rpc`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-version',
        id: 1,
      }),
      signal: controller.signal,
      mode: 'cors', // Explicitly request CORS
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const endTime = performance.now();
    return Math.round(endTime - startTime);
  } catch (error) {
    // Expected to fail for most nodes (CORS, localhost-only, mixed content, etc.)
    // This is normal and not an error condition
    return null;
  }
}

/**
 * Format latency with context
 */
export function formatLatencyWithContext(
  latency: number | null | undefined,
  ranking: LatencyRanking | null,
  clientLatency: number | null = null
): string {
  if (latency === null || latency === undefined) {
    return 'N/A';
  }

  const parts: string[] = [];

  // Add ranking if available
  if (ranking) {
    parts.push(`[${ranking.label}]`);
  }

  // Add server latency
  parts.push(`Server: ${latency}ms`);

  // Add client latency if available
  if (clientLatency !== null) {
    parts.push(`Your: ${clientLatency}ms`);
  }

  return parts.join(' ');
}

/**
 * Get latency color based on ranking or absolute value
 */
export function getLatencyColor(
  latency: number | null,
  ranking: LatencyRanking | null = null
): string {
  if (latency === null) return 'text-red-600';
  
  // Prefer ranking-based color if available
  if (ranking) {
    return ranking.color;
  }

  // Fallback to absolute value-based color
  if (latency < 50) return 'text-green-500';
  if (latency < 100) return 'text-green-400';
  if (latency < 200) return 'text-yellow-500';
  if (latency < 400) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Get latency tooltip text
 */
export function getLatencyTooltip(
  latency: number | null,
  ranking: LatencyRanking | null,
  clientLatency: number | null,
  context: LatencyContext | null
): string {
  const parts: string[] = [];

  if (latency === null) {
    return 'Latency data not available. Most nodes keep pRPC private (localhost-only) for security, so client-side latency measurement is not possible.';
  }

  // Latency is now always client-side (user's browser)
  parts.push(`Your Latency: ${latency}ms`);
  parts.push('(Measured from your browser)');

  if (ranking) {
    parts.push(`\n\nRanking: ${ranking.label} (${ranking.percentile.toFixed(1)}th percentile)`);
    parts.push('(Compared to all nodes in the network)');
    parts.push('Note: Ranking uses server-side latency data for comparison, but displayed latency is measured from your location.');
  }

  if (context) {
    parts.push(`\n\nNode Location: ${context.nodeRegion}`);
    parts.push(`Expected latency ranges:`);
    parts.push(`• Same region: ${context.expectedRanges.sameRegion}`);
    parts.push(`• Nearby region: ${context.expectedRanges.nearbyRegion}`);
    parts.push(`• Far region: ${context.expectedRanges.farRegion}`);
  } else {
    parts.push('\n\nNote: Latency is measured from your geographic location. Actual latency depends on your distance from the node.');
  }

  return parts.join('\n');
}

