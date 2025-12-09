/**
 * Ping endpoint - fetches real-time latency on-demand
 */

import { NextResponse } from 'next/server';
import http from 'http';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');
  const port = searchParams.get('port') || '6000';

  if (!ip) {
    return NextResponse.json(
      { error: 'ip parameter required' },
      { status: 400 }
    );
  }

  // Real-time latency - fetch on-demand
    const startTime = Date.now();
    
  try {
    return new Promise<NextResponse>((resolve) => {
      const options = {
        hostname: ip,
        port: parseInt(port),
        path: '/rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify({
          jsonrpc: '2.0',
          method: 'get-version',
          id: 1,
            params: [],
          })),
        },
        timeout: 3000,
      };

      const req = http.request(options, () => {
        const latency = Date.now() - startTime;
        resolve(NextResponse.json({
          latency,
          status: 'online',
        }));
        });

      req.on('error', () => {
        resolve(NextResponse.json({
          latency: null,
          status: 'offline',
          error: 'Connection failed',
        }));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(NextResponse.json({
          latency: null,
          status: 'offline',
          error: 'Timeout',
        }));
      });

      req.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-version',
        id: 1,
        params: [],
      }));
      req.end();
    });
  } catch (error: any) {
    return NextResponse.json({
        latency: null,
        status: 'offline',
      error: error?.message || 'Ping failed',
    });
  }
}

