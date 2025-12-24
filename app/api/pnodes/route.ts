/**
 * API endpoint for nodes - Proxies to Render backend
 * 
 * Render backend handles:
 * - Reading from MongoDB
 * - Triggering refresh if needed
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      {
        error: 'Render API URL not configured',
        nodes: [],
        totalNodes: 0,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('network');
    const refresh = searchParams.get('refresh') === 'true';

    console.log('[VercelProxy] Proxying pnodes request to Render...');

    // Build query string
    const queryParams = new URLSearchParams();
    if (networkId) queryParams.set('network', networkId);
    if (refresh) queryParams.set('refresh', 'true');

    const url = `${RENDER_API_URL}/api/pnodes${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          ...data,
          nodes: data.nodes || [],
          totalNodes: data.count || 0,
          timestamp: Date.now(),
        },
        { status: response.status }
      );
    }

    console.log(`[VercelProxy] ✅ Returning ${data.nodes?.length || 0} nodes from Render`);

    // Format response to match expected format
    return NextResponse.json(
      {
        nodes: data.nodes || [],
        totalNodes: data.count || data.nodes?.length || 0,
        timestamp: data.timestamp || Date.now(),
        networks: data.networks,
        currentNetwork: data.currentNetwork,
      },
      {
        headers: {
          // More aggressive caching: 2min cache, 5min stale-while-revalidate
          // This allows instant responses while revalidating in the background
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300, max-age=60',
          'CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    const errorMessage = error?.message || 'Failed to fetch nodes';
    const errorCode = error?.code || 'UNKNOWN';

    console.error('[VercelProxy] ❌ Failed to proxy to Render:', {
      error: errorMessage,
      code: errorCode,
      url: RENDER_API_URL,
      hint: errorCode === 'UND_ERR_SOCKET'
        ? 'Connection closed. Is the Render API server running on port 3001? Run: npm run dev:api'
        : 'Check RENDER_API_URL in .env.local and ensure the API server is running',
    });

    return NextResponse.json(
      {
        error: errorMessage,
        errorCode,
        hint: errorCode === 'UND_ERR_SOCKET'
          ? 'Render API server connection failed. Make sure the backend server is running: npm run dev:api'
          : 'Failed to connect to Render API server. Check RENDER_API_URL in .env.local',
        nodes: [],
        timestamp: Date.now(),
        totalNodes: 0,
      },
      { status: 503 } // Service Unavailable
    );
  }
}
