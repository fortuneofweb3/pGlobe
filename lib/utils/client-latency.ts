/**
 * Client-side latency measurement
 * Measures latency from user's browser to proxy endpoints and individual nodes
 * This gives accurate latency for each user's actual location
 * 
 * Latency measurements are cached for 6 hours to reduce API calls
 */

import { PNode } from '../types/pnode';

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY_PREFIX = 'node_latency_';

interface CachedLatency {
  latency: number | null;
  timestamp: number;
}

/**
 * Get cached latency for a node
 * Exported for use in components that need to check cache synchronously
 */
export function getCachedLatency(nodeId: string): number | null | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${nodeId}`);
    if (!cached) return undefined;
    
    const data: CachedLatency = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // Return cached value if still valid
    if (age < CACHE_DURATION_MS) {
      return data.latency;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${nodeId}`);
    return undefined;
  } catch (error) {
    console.warn('[ClientLatency] Failed to read cache:', error);
    return undefined;
  }
}

/**
 * Cache latency for a node
 */
function setCachedLatency(nodeId: string, latency: number | null): void {
  if (typeof window === 'undefined') return;
  
  try {
    const data: CachedLatency = {
      latency,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${nodeId}`, JSON.stringify(data));
  } catch (error) {
    console.warn('[ClientLatency] Failed to write cache:', error);
  }
}

/**
 * Get all cached latencies
 */
function getAllCachedLatencies(): Record<string, number | null> {
  if (typeof window === 'undefined') return {};
  
  const results: Record<string, number | null> = {};
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        const nodeId = key.replace(CACHE_KEY_PREFIX, '');
        const cached = getCachedLatency(nodeId);
        if (cached !== undefined) {
          results[nodeId] = cached;
        }
      }
    }
  } catch (error) {
    console.warn('[ClientLatency] Failed to read all cached latencies:', error);
  }
  
  return results;
}

// Proxy endpoints - same as server
const PROXY_RPC_ENDPOINTS = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

/**
 * Measure latency to proxy endpoints from client
 * Returns the best (lowest) latency
 */
export async function measureProxyLatencyFromClient(): Promise<number | null> {
  const endpoints = PROXY_RPC_ENDPOINTS;
  const measurements: number[] = [];

  // Measure all proxy endpoints in parallel
  const promises = endpoints.map(async (endpoint) => {
    try {
      const startTime = performance.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Use our API route to avoid CORS issues
      const response = await fetch('/api/measure-latency?target=' + encodeURIComponent(endpoint), {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const latency = data.latency || (performance.now() - startTime);
      
      return Math.round(latency);
    } catch (error) {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      measurements.push(result.value);
    }
  }

  if (measurements.length === 0) {
    return null;
  }

  // Return the best (lowest) latency
  return Math.min(...measurements);
}

/**
 * Measure latency to a specific endpoint from client
 */
export async function measureLatencyToEndpoint(endpoint: string): Promise<number | null> {
  try {
    const startTime = performance.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Use our API route to avoid CORS issues
    const response = await fetch('/api/measure-latency?target=' + encodeURIComponent(endpoint), {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const latency = data.latency || (performance.now() - startTime);
    
    return Math.round(latency);
  } catch (error) {
    return null;
  }
}

/**
 * Measure latency to proxy endpoints and return all results
 */
export async function measureAllProxyLatencies(): Promise<Record<string, number>> {
  const endpoints = PROXY_RPC_ENDPOINTS;
  const results: Record<string, number> = {};

  // Measure all proxy endpoints in parallel
  const promises = endpoints.map(async (endpoint) => {
    try {
      const latency = await measureLatencyToEndpoint(endpoint);
      return { endpoint, latency };
    } catch (error) {
      return { endpoint, latency: null };
    }
  });

  const measurements = await Promise.allSettled(promises);
  
  for (const result of measurements) {
    if (result.status === 'fulfilled' && result.value.latency !== null) {
      results[result.value.endpoint] = result.value.latency;
    }
  }

  return results;
}

/**
 * Measure latency to a specific node from client
 * Tries to ping the node's pRPC endpoint directly
 * Returns null if node is not reachable
 * Uses cache if available (6 hour expiration)
 */
export async function measureNodeLatency(node: PNode, timeoutMs: number = 2000): Promise<number | null> {
  if (!node.address) return null;
  
  // Check cache first
  const cached = getCachedLatency(node.id);
  if (cached !== undefined) {
    return cached;
  }
  
  const addressParts = node.address.split(':');
  const ip = addressParts[0];
  const port = node.rpcPort?.toString() || addressParts[1] || '6000';
  
  if (!ip) return null;
  
  // Try to ping node directly via our API route
  // The API route will handle the actual HTTP request to avoid CORS issues
  try {
    const startTime = performance.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Use our API route to measure latency to the node
    const response = await fetch(`/api/measure-latency?target=http://${ip}:${port}/rpc`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Cache null result (node not reachable)
      setCachedLatency(node.id, null);
      return null;
    }
    
    const data = await response.json();
    
    // Use the latency from the API response, or fallback to client-side measurement
    const latency = data.latency || (performance.now() - startTime);
    const roundedLatency = Math.round(latency);
    
    // Cache the result
    setCachedLatency(node.id, roundedLatency);
    
    return roundedLatency;
  } catch (error) {
    // Node is not reachable (timeout, CORS, firewall, etc.)
    // Cache null result
    setCachedLatency(node.id, null);
    return null;
  }
}

/**
 * Get cached latencies for nodes (synchronous, for immediate display)
 * Returns a map of node ID to latency for nodes that have valid cache
 */
export function getCachedNodesLatencies(nodes: PNode[]): Record<string, number | null> {
  const results: Record<string, number | null> = {};
  
  if (typeof window === 'undefined') return results;
  
  // Load all cached latencies
  const cachedLatencies = getAllCachedLatencies();
  
  // Return cached values for nodes that exist
  for (const node of nodes) {
    const cached = cachedLatencies[node.id];
    if (cached !== undefined) {
      results[node.id] = cached;
    }
  }
  
  return results;
}

/**
 * Measure latency to multiple nodes in parallel (with concurrency limit)
 * Returns a map of node ID to latency
 * Uses cache for nodes that have been measured recently (6 hour expiration)
 * Only measures nodes that aren't cached
 */
export async function measureNodesLatency(
  nodes: PNode[],
  concurrency: number = 10,
  timeoutMs: number = 2000
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {};
  
  // Load all cached latencies first
  const cachedLatencies = getAllCachedLatencies();
  
  // Separate nodes into cached and uncached
  const uncachedNodes: PNode[] = [];
  
  for (const node of nodes) {
    const cached = cachedLatencies[node.id];
    if (cached !== undefined) {
      // Use cached value immediately
      results[node.id] = cached;
    } else {
      // Need to measure this node
      uncachedNodes.push(node);
    }
  }
  
  // Only measure uncached nodes
  if (uncachedNodes.length === 0) {
    return results;
  }
  
  // Process uncached nodes in batches to avoid overwhelming the browser
  for (let i = 0; i < uncachedNodes.length; i += concurrency) {
    const batch = uncachedNodes.slice(i, i + concurrency);
    
    const promises = batch.map(async (node) => {
      const latency = await measureNodeLatency(node, timeoutMs);
      return { nodeId: node.id, latency };
    });
    
    const batchResults = await Promise.allSettled(promises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value.nodeId] = result.value.latency;
      }
    }
  }
  
  return results;
}

