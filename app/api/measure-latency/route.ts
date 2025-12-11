/**
 * Multi-region latency measurement endpoint
 * Can be called from Cloudflare Workers or other edge locations
 * Measures latency to proxy RPC endpoints from the caller's location
 */

import { NextResponse } from 'next/server';

const PROXY_RPC_ENDPOINTS_LIST = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

/**
 * Measure latency to proxy endpoint using TTFB
 */
async function measureProxyLatency(rpcUrl: string, timeoutMs: number = 2000): Promise<number | null> {
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
        timeout: timeoutMs,
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

      req.setTimeout(timeoutMs);
      req.write(requestBody);
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target'); // Optional: specific endpoint to measure
  const region = searchParams.get('region'); // Optional: caller's region
  
  // Get caller's location from headers (Cloudflare Workers set CF-IPCountry)
  const country = request.headers.get('cf-ipcountry') || 
                 request.headers.get('x-vercel-ip-country') ||
                 null;
  
  // If specific target provided, measure only that
  if (target) {
    // Handle both HTTP and HTTPS URLs
    const latency = await measureProxyLatency(target, 2000);
    return NextResponse.json({
      region: region || 'unknown',
      country: country || 'unknown',
      target,
      latency,
      timestamp: Date.now(),
    });
  }
  
  // Otherwise measure all proxy endpoints
  const results: Array<{ endpoint: string; latency: number | null }> = [];
  
  // Measure latency to each proxy endpoint
  for (const endpoint of PROXY_RPC_ENDPOINTS_LIST) {
    const latency = await measureProxyLatency(endpoint, 2000);
    results.push({ endpoint, latency });
  }
  
  // Find best latency
  const validResults = results.filter(r => r.latency !== null);
  const bestLatency = validResults.length > 0
    ? Math.min(...validResults.map(r => r.latency!))
    : null;
  
  return NextResponse.json({
    region: region || 'unknown',
    country: country || 'unknown',
    timestamp: Date.now(),
    latencies: results,
    bestLatency,
  });
}

