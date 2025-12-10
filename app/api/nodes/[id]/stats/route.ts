/**
 * Get node stats - Proxies to backend API server
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const nodeId = params.id;
  
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { error: 'Backend API URL not configured. Set RENDER_API_URL in .env.local' },
      { status: 500 }
    );
  }

  try {
    console.log('[VercelProxy] Proxying node stats request to backend...');
    
    const response = await fetch(`${RENDER_API_URL}/api/nodes/${nodeId}`, {
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

    // Format response to match expected format
    return NextResponse.json({
      success: true,
      data: data.node || data,
    });
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to backend:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch node stats' },
      { status: 500 }
    );
  }
}
