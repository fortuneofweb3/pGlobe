/**
 * AWS Lambda function for multi-region latency measurement
 * Deploy this to AWS Lambda in specific regions
 * 
 * Features:
 * - Per-node latency measurement (direct node queries)
 * - Proxy fallback for unreachable nodes
 * - Batch measurement endpoint
 * - Region from Lambda context
 * 
 * Deployment:
 * - Deploy to us-east-1 (N. Virginia) for US East
 * - Deploy to eu-west-1 (Ireland) for EU West
 * - Deploy to ap-southeast-1 (Singapore) for Asia East
 * - Deploy to af-south-1 (Cape Town) for Africa South
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

exports.handler = async (event) => {
  // Get region from Lambda context
  const region = process.env.AWS_REGION || 'unknown';
  
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  
  // Parse request
  const path = event.path || event.requestContext?.http?.path || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : null;
  
  // Batch measurement endpoint
  if (path === '/measure-batch' && method === 'POST') {
    try {
      const { targets, proxyEndpoint } = body || {};
      
      if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid request: targets must be a non-empty array',
          }),
        };
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
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          region,
          proxyEndpoint: proxy,
          latencies,
          timestamp: Date.now(),
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: error.message,
          timestamp: Date.now(),
        }),
      };
    }
  }
  
  // Legacy single measurement endpoint
  const target = event.queryStringParameters?.target || 'https://rpc1.pchednode.com/rpc';
  const latency = await measureLatency(target);
  
  if (latency === null) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        region,
        target,
        error: 'Measurement failed',
        timestamp: Date.now(),
      }),
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      region,
      target,
      latency,
      timestamp: Date.now(),
    }),
  };
};

