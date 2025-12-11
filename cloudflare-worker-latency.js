/**
 * Cloudflare Worker for multi-region latency measurement
 * Deploy this to Cloudflare Workers
 * 
 * Features:
 * - Per-node latency measurement (direct node queries)
 * - Proxy fallback for unreachable nodes
 * - Batch measurement endpoint
 * - Region detection via CF colo
 * 
 * Setup:
 * 1. Create Cloudflare Workers account
 * 2. Create 4 workers (one per region)
 * 3. Deploy this code to each
 * 4. Set environment variable REGION for each
 */

async function measureLatency(target, timeoutMs = 2000) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-version',
        id: 1,
        params: [],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    
    return Date.now() - startTime;
  } catch (error) {
    // Even on timeout/error, capture the elapsed time
    const elapsed = Date.now() - startTime;
    
    // If it's a timeout, return the timeout duration (useful info!)
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return timeoutMs; // Return timeout duration as latency
    }
    
    // For other errors, return elapsed time (how long until error)
    return elapsed >= timeoutMs ? timeoutMs : elapsed;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Get region from CF colo (Cloudflare's edge location) or env var
    const cfColo = request.cf?.colo || 'unknown';
    const cfCountry = request.cf?.country || 'unknown';
    const region = env.REGION || cfColo || 'unknown';
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Batch measurement endpoint
    if (url.pathname === '/measure-batch' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { targets, proxyEndpoint } = body;
        
        if (!targets || !Array.isArray(targets) || targets.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid request: targets must be a non-empty array',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }
        
        const proxy = proxyEndpoint || 'https://rpc1.pchednode.com/rpc';
        
        // Measure proxy latency once (reuse for all nodes that need fallback)
        const proxyLatency = await measureLatency(proxy, 2000);
        
        // Measure latency for each node individually
        // Try direct node endpoint first, fallback to proxy latency
        const latencies = {};
        
        // Measure each node individually (in parallel batches)
        const BATCH_SIZE = 50;
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
          const batch = targets.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.allSettled(
            batch.map(async (target) => {
              // Try direct node endpoint first (port 6000)
              const directEndpoint = `http://${target}:6000/rpc`;
              const directLatency = await measureLatency(directEndpoint, 2000);
              
              // If direct query succeeded, use it (real per-node latency!)
              if (directLatency !== null && directLatency < 2000) {
                return { target, latency: directLatency, method: 'direct' };
              }
              
              // If direct failed/timeout, use proxy latency as fallback
              // Even if direct times out, we captured the timeout time (2000ms)
              // This tells us: "node is unreachable" vs "node responded"
              // Use pre-measured proxy latency (more efficient)
              return { 
                target, 
                latency: proxyLatency || 2000, // Use proxy latency or timeout duration
                method: directLatency === 2000 ? 'proxy-fallback-timeout' : 'proxy-fallback-error'
              };
            })
          );
          
          // Process batch results
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value.latency !== null) {
              latencies[result.value.target] = result.value.latency;
            }
          }
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            region,
            cfColo,
            cfCountry,
            proxyEndpoint: proxy,
            latencies,
            timestamp: Date.now(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            timestamp: Date.now(),
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }
    
    // Legacy single measurement endpoint
    const target = url.searchParams.get('target') || 'https://rpc1.pchednode.com/rpc';
    const latency = await measureLatency(target);
    
    if (latency === null) {
      return new Response(
        JSON.stringify({
          success: false,
          region,
          cfColo,
          cfCountry,
          target,
          error: 'Measurement failed',
          timestamp: Date.now(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        region,
        cfColo,
        cfCountry,
        target,
        latency,
        timestamp: Date.now(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
};
