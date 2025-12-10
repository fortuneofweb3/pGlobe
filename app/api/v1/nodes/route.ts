/**
 * Public API v1: List all nodes
 * GET /api/v1/nodes
 * Proxies to backend API server
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export const GET = withAPIAuth(async (request: Request, { apiKey }) => {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { success: false, error: 'Backend API URL not configured. Set RENDER_API_URL in .env.local' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams(searchParams); // Forward all query params

    console.log('[VercelProxy] Proxying /api/v1/nodes request to backend...');

    const url = `${RENDER_API_URL}/api/v1/nodes?${queryParams.toString()}`;
    
    const response = await fetch(url, {
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

    console.log(`[VercelProxy] ✅ Returning ${data.data?.length || 0} nodes from backend for /api/v1/nodes`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy /api/v1/nodes to backend:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
});

