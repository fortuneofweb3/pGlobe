/**
 * API endpoint for nodes - Proxies to Render backend
 * 
 * Render backend handles:
 * - Reading from MongoDB
 * - Triggering refresh if needed
 */

import { NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { getManagerPurchaseStats } from '@/lib/server/manager-discovery';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  // DEVELOPMENT OVERRIDE:
  // If we are in development, use the local library logic directly.
  // This avoids needing to run a separate backend server or wait for remote deployment.
  // UNLESS process.env.USE_REMOTE_BACKEND is set.
  if (process.env.NODE_ENV === 'development' && !process.env.USE_REMOTE_BACKEND) {
    try {
      const { searchParams } = new URL(request.url);
      const network = searchParams.get('network') || 'all';

      console.log(`[VercelProxy] 🔧 DEV MODE: Fetching ${network} nodes directly from local DB...`);
      const nodes = await getAllNodes(network);

      // Stats Logic (Duplicated from backend for local dev)
      const connectedManagers = new Set<string>();
      nodes.forEach(n => {
        if (n.managerWallet) connectedManagers.add(n.managerWallet);
      });

      const allStats = await getManagerPurchaseStats();
      const filteredStats: Record<string, number> = {};
      for (const wallet of connectedManagers) {
        if (allStats.has(wallet)) {
          filteredStats[wallet] = allStats.get(wallet)!;
        }
      }

      return NextResponse.json({
        nodes,
        managerStats: filteredStats,
        totalNodes: nodes.length,
        timestamp: Date.now()
      });
    } catch (e: any) {
      console.error('[VercelProxy] Local fetch failed:', e);
      // Fallthrough to proxy if local fails? Or just error.
      return NextResponse.json({ error: e.message || 'Local fetch failed' }, { status: 500 });
    }
  }

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
        managerStats: data.managerStats,
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
