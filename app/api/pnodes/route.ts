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
      },
      {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
      }
    );
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to Render:', error);
    
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch nodes',
        nodes: [],
        timestamp: Date.now(),
        totalNodes: 0,
      },
      { status: 500 }
    );
  }
}
