/**
 * API endpoint to sync node data - Proxies to Render backend
 * 
 * Render backend handles:
 * - pRPC fetching from gossip
 * - MongoDB writes
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function POST(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { error: 'Render API URL not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('network') || 'devnet1';
    
    console.log('[VercelProxy] Proxying sync request to Render...');
    
    const response = await fetch(`${RENDER_API_URL}/api/sync-nodes?network=${networkId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[VercelProxy] ✅ Sync completed via Render');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to Render:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync nodes',
        message: error?.message || 'Failed to connect to Render API',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status - Proxies to Render
 */
export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { error: 'Render API URL not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('[VercelProxy] Proxying sync status request to Render...');
    
    const response = await fetch(`${RENDER_API_URL}/api/pnodes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Format response similar to old format
    const nodes = data.nodes || [];
    const sampleNodes = nodes.slice(0, 3).map((n: any) => ({
      pubkey: n.pubkey?.substring(0, 20) + '...',
      address: n.address,
      location: n.location,
      locationCity: n.locationData?.city,
      locationCountry: n.locationData?.country,
      lat: n.locationData?.lat,
      lon: n.locationData?.lon,
      version: n.version,
      balance: n.balance,
    }));

    return NextResponse.json({
      totalNodes: nodes.length,
      withGeo: nodes.filter((n: any) => n.locationData?.lat && n.locationData?.lon).length,
      withBalance: nodes.filter((n: any) => n.balance !== null && n.balance !== undefined).length,
      sampleNodes,
    });
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to Render:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

