/**
 * Public API v1: Network statistics
 * GET /api/v1/network/stats
 * Proxies to backend API server
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export const GET = withAPIAuth(async (request: Request) => {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      { success: false, error: 'Backend API URL not configured. Set RENDER_API_URL in .env.local' },
      { status: 500 }
    );
  }

  try {
    console.log('[VercelProxy] Proxying /api/v1/network/stats request to backend...');
    
    const response = await fetch(`${RENDER_API_URL}/api/v1/network/stats`, {
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

    console.log('[VercelProxy] ✅ Returning network stats from backend');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy /api/v1/network/stats to backend:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch network stats' },
      { status: 500 }
    );
  }
});

