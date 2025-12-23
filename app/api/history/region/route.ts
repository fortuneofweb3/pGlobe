/**
 * Region historical data endpoint - Proxies to API server (local in dev, Render in production)
 *
 * API server handles:
 * - Aggregating historical snapshots by region/country
 * - Filtering nodes by country
 * - Calculating aggregated metrics
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      {
        error: 'API server URL not configured',
        data: [],
        count: 0,
      },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    
    const url = `${RENDER_API_URL}/api/history/region${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    console.log('[VercelProxy] Proxying region history request to API server:', url);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
    
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
        console.error('[VercelProxy] ❌ Region history request to API server timed out after 45 seconds');
        return NextResponse.json(
          {
            error: 'Request timeout - API server took too long to respond',
            data: [],
            count: 0,
          },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    let data: any;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('[VercelProxy] ❌ Failed to parse region history response as JSON:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid response from API server',
          data: [],
          count: 0,
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[VercelProxy] ❌ API server returned error:', response.status, data);
      return NextResponse.json(
        {
          ...data,
          error: data.error || 'Failed to fetch region history',
        },
        { status: response.status }
      );
    }

    console.log(`[VercelProxy] ✅ Returning region history from API server: ${data.count || 0} data points`);
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy region history to API server:', error);
    
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch region history',
        data: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

