/**
 * Public API v1: Network health history
 * GET /api/v1/network/health/history?period=24h|7d|30d
 * Returns historical network health scores over time
 * Proxies to backend API server (Render)
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

// Note: This endpoint doesn't require authentication to allow public access
export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    console.error('[NetworkHealthHistory] ❌ Backend API URL not configured');
    return NextResponse.json(
      {
        success: false,
        error: 'Backend API URL not configured. Set RENDER_API_URL in .env.local',
        data: {
          health: [],
        },
      },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    console.log(`[NetworkHealthHistory] Proxying health history request to backend: period=${period}`);

    // Proxy to backend API server
    const url = `${RENDER_API_URL}/api/v1/network/health/history?period=${period}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[NetworkHealthHistory] ❌ Backend API returned error:', response.status, data);
      return NextResponse.json(
        {
          success: false,
          error: data.error || 'Failed to fetch network health history',
          data: {
            health: [],
          },
        },
        { status: response.status }
      );
    }

    console.log(`[NetworkHealthHistory] ✅ Returning health history from backend: ${data.data?.health?.length || 0} data points`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[NetworkHealthHistory] ❌ Failed to fetch health history:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch network health history',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
