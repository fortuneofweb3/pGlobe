/**
 * Multi-region latency measurement (Provider-Agnostic)
 * Measures latency from multiple geographic regions using any HTTP endpoint:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Self-hosted VPS
 * - AWS Lambda@Edge
 * - Any HTTP endpoint that implements the /measure-batch API
 */

import { LATENCY_REGIONS } from '../utils/latency-regions';
import { PROXY_RPC_ENDPOINTS } from './prpc';

const PROXY_ENDPOINTS = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

/**
 * Measure latency from a specific region
 * This should be called from Cloudflare Workers deployed in that region
 * Or from a server/VPS located in that region
 */
export async function measureLatencyFromRegion(
  regionId: string,
  baseUrl?: string
): Promise<number | null> {
  // If baseUrl is provided, call our measurement API from that region
  // Otherwise, measure directly (when running from that region)
  const measurementUrl = baseUrl 
    ? `${baseUrl}/api/measure-latency?region=${regionId}`
    : null;
  
  if (measurementUrl) {
    try {
      const response = await fetch(measurementUrl, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.bestLatency || null;
    } catch (error) {
      console.error(`[MultiRegionLatency] Failed to measure from ${regionId}:`, error);
      return null;
    }
  }
  
  // Direct measurement (when running from that region)
  // This would be used when the code is actually running in that region
  return await measureProxyLatencyDirect();
}

/**
 * Direct proxy latency measurement (when running from a specific region)
 */
async function measureProxyLatencyDirect(): Promise<number | null> {
  const latencies: number[] = [];
  
  for (const endpoint of PROXY_ENDPOINTS) {
    const latency = await measureSingleProxy(endpoint);
    if (latency !== null) {
      latencies.push(latency);
    }
  }
  
  return latencies.length > 0 ? Math.min(...latencies) : null;
}

/**
 * Measure latency to a single proxy endpoint
 */
async function measureSingleProxy(rpcUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let firstByteReceived = false;
    
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-version',
      id: 1,
      params: [],
    });

    try {
      const urlObj = new URL(rpcUrl);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: 2000,
      };

      const req = httpModule.request(options, (res: any) => {
        res.once('data', () => {
          if (!firstByteReceived) {
            firstByteReceived = true;
            const latency = Date.now() - startTime;
            res.on('data', () => {});
            res.on('end', () => {
              req.destroy();
              resolve(latency);
            });
          }
        });

        res.on('error', () => {
          resolve(null);
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.setTimeout(2000);
      req.write(requestBody);
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Measure latency from multiple regions for all nodes
 * Uses BATCHED approach: single HTTP call per region with all node IPs
 * This keeps us well within free tier limits (8 requests per refresh instead of 1,272)
 * 
 * @param regionEndpoints - HTTP endpoint URLs for each region (any provider)
 * @param nodeIPs - Array of node IP addresses to measure latency for
 * @returns Map of region -> node IP -> latency: { 'us-east': { '1.2.3.4': 50, '5.6.7.8': 120 }, ... }
 */
export async function measureLatencyFromMultipleRegions(
  regionEndpoints: Record<string, string>, // { 'us-east': 'https://us-east-worker.example.com', ... }
  nodeIPs: string[] // Array of node IPs to measure
): Promise<Record<string, Record<string, number>>> {
  const results: Record<string, Record<string, number>> = {};
  
  if (nodeIPs.length === 0) {
    return results;
  }
  
  // Batch measurement: single worker call per region with all node IPs
  const measurements = await Promise.allSettled(
    Object.entries(regionEndpoints).map(async ([regionId, endpoint]) => {
      try {
        // Call measurement endpoint (provider-agnostic) with batch of node IPs
        const response = await fetch(`${endpoint}/measure-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Xandeum-Analytics/1.0',
          },
          body: JSON.stringify({
            targets: nodeIPs, // Array of node IPs to measure (each will be measured individually)
            proxyEndpoint: 'https://rpc1.pchednode.com/rpc', // Proxy endpoint (nodes use this proxy)
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout for batch measurement
        });
        
        if (!response.ok) {
          console.warn(`[MultiRegionLatency] ${regionId} returned ${response.status}`);
          return { regionId, latencies: null };
        }
        
        const data = await response.json();
        // Expected format: { '1.2.3.4': 50, '5.6.7.8': 120, ... }
        return { regionId, latencies: data.latencies || null };
      } catch (error: any) {
        console.warn(`[MultiRegionLatency] Failed to measure from ${regionId}:`, error.message);
        return { regionId, latencies: null };
      }
    })
  );
  
  for (const result of measurements) {
    if (result.status === 'fulfilled' && result.value.latencies !== null) {
      results[result.value.regionId] = result.value.latencies;
    }
  }
  
  const totalMeasurements = Object.values(results).reduce((sum, regionLatencies) => sum + Object.keys(regionLatencies).length, 0);
  console.log(`[MultiRegionLatency] Measured ${totalMeasurements} node latencies from ${Object.keys(results).length}/${Object.keys(regionEndpoints).length} regions`);
  
  return results;
}

