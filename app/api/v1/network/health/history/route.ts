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
    console.log(`[NetworkHealthHistory] RENDER_API_URL: ${RENDER_API_URL ? 'SET' : 'NOT SET'}`);
    console.log(`[NetworkHealthHistory] API_SECRET: ${API_SECRET ? 'SET' : 'NOT SET'}`);

    // Proxy to backend API server
    const url = `${RENDER_API_URL}/api/v1/network/health/history?period=${period}`;
    console.log(`[NetworkHealthHistory] Backend URL: ${url}`);

    // Add timeout to backend fetch (40 seconds - allows time for MongoDB + calculation)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('[NetworkHealthHistory] ❌ Backend fetch timeout after 40 seconds');
    }, 40000); // 40 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[NetworkHealthHistory] ❌ Backend fetch timed out');
        return NextResponse.json(
          {
            success: false,
            error: 'Backend API timeout - the backend server took too long to respond. Check if the backend is running and accessible.',
            data: {
              health: [],
            },
          },
          { status: 504 }
        );
      }
      console.error('[NetworkHealthHistory] ❌ Backend fetch error:', {
        error: fetchError.message,
        name: fetchError.name,
        cause: fetchError.cause,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to connect to backend: ${fetchError.message}. Check if RENDER_API_URL is correct and the backend is running.`,
          data: {
            health: [],
          },
        },
        { status: 502 }
      );
    }

    console.log(`[NetworkHealthHistory] Backend response status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log(`[NetworkHealthHistory] Backend response data:`, {
      success: data.success,
      hasData: !!data.data,
      hasHealth: !!data.data?.health,
      healthLength: data.data?.health?.length || 0,
      dataPoints: data.data?.dataPoints || 0,
      error: data.error,
    });

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

    // Log detailed response structure
    if (data.success && data.data) {
      console.log(`[NetworkHealthHistory] ✅ Returning health history from backend: ${data.data.health?.length || 0} data points`);
      if (data.data.health && data.data.health.length > 0) {
        // Log first point for verification
        const first = data.data.health[0];
        console.log(`[NetworkHealthHistory] Sample data point: score=${first.networkHealthScore}, avail=${first.networkHealthAvailability}, ver=${first.networkHealthVersion}`);
      }
    } else {
      console.error(`[NetworkHealthHistory] ❌ Backend response missing expected structure:`, data);
    }

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
