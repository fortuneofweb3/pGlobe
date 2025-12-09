/**
 * Ping endpoint - fetches real-time latency on-demand
 */

import { NextResponse } from 'next/server';
import http from 'http';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');
  const port = searchParams.get('port') || '6000';

  if (!ip) {
    return NextResponse.json(
      { error: 'ip parameter required' },
      { status: 400 }
    );
  }

  // Real-time latency - fetch on-demand with optimized timeout
  const startTime = Date.now();
  const timeout = 2000; // 2 second timeout for faster response
    
  try {
    return new Promise<NextResponse>((resolve) => {
      const requestBody = JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-version',
        id: 1,
      });
      
      const options = {
        hostname: ip,
        port: parseInt(port),
        path: '/rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout,
      };

      const req = http.request(options, (res) => {
        // Success - calculate latency
        const latency = Date.now() - startTime;
        res.on('data', () => {}); // Consume response
        res.on('end', () => {
          resolve(NextResponse.json({
            latency,
            status: 'online',
          }));
        });
      });

      req.on('error', (err) => {
        resolve(NextResponse.json({
          latency: null,
          status: 'offline',
          error: 'Connection failed',
        }, { status: 200 })); // Return 200 to avoid client errors
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(NextResponse.json({
          latency: null,
          status: 'offline',
          error: 'Timeout',
        }, { status: 200 }));
      });

      req.setTimeout(timeout);
      req.write(requestBody);
      req.end();
    });
  } catch (error: any) {
    return NextResponse.json({
      latency: null,
      status: 'offline',
      error: error?.message || 'Ping failed',
    }, { status: 200 });
  }
}

