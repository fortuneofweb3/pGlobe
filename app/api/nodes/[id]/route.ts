/**
 * Get a single node by ID - Proxies to Render backend
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { error: 'Render API URL not configured' },
      { status: 500 }
    );
  }

  try {
    const nodeId = params.id;
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    console.log('[VercelProxy] Proxying node request to Render...');
    
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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy to Render:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch node' },
      { status: 500 }
    );
  }
}

