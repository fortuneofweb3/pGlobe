/**
 * Background refresh endpoint - Proxies to Render backend
 * 
 * This endpoint proxies requests to the Render API server which handles:
 * - pRPC fetching from gossip
 * - MongoDB writes
 * 
 * Vercel routes no longer directly access MongoDB or pRPC
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { error: 'Render API URL not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('[VercelProxy] Proxying refresh request to Render...');
    
    const response = await fetch(`${RENDER_API_URL}/api/refresh-nodes`, {
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

    console.log('[VercelProxy] ✅ Refresh completed via Render');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to Render:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to connect to Render API',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request); // Same logic for POST
}

