/**
 * Bulk historical data endpoint - Fetches history for multiple nodes in one request
 * This is much faster than fetching nodes one-by-one for region pages
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  if (!RENDER_API_URL) {
    return NextResponse.json(
      {
        error: 'API server URL not configured',
        data: {},
        count: 0,
      },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Get comma-separated list of node IDs
    const nodeIds = searchParams.get('nodeIds');
    if (!nodeIds) {
      return NextResponse.json(
        {
          error: 'nodeIds parameter is required (comma-separated list)',
          data: {},
          count: 0,
        },
        { status: 400 }
      );
    }

    const url = `${RENDER_API_URL}/api/history/bulk${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    console.log('[VercelProxy] Proxying bulk history request to API server:', url);
    console.log('[VercelProxy] Request params:', {
      nodeIds: searchParams.get('nodeIds')?.substring(0, 50) + '...',
      nodeCount: searchParams.get('nodeIds')?.split(',').length || 0,
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
    });

    // Create AbortController for timeout
    // Increased timeout to 60 seconds for bulk requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
        console.error('[VercelProxy] ❌ Bulk request to API server timed out after 60 seconds');
        return NextResponse.json(
          {
            error: 'Request timeout - API server took too long to respond',
            data: {},
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
      console.error('[VercelProxy] ❌ Failed to parse response as JSON:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid response from API server',
          data: {},
          count: 0,
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[VercelProxy] ❌ API server returned error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error || data.message,
        data: data
      });
      return NextResponse.json(
        {
          ...data,
          error: data.error || data.message || 'Failed to fetch bulk historical data',
        },
        { status: response.status }
      );
    }

    console.log(`[VercelProxy] ✅ Returning bulk historical data from API server:`, {
      hasData: !!data.data,
      dataType: typeof data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
      nodeCount: data.nodeCount || 0,
      totalPoints: data.count || 0,
    });

    return NextResponse.json(data, {
      headers: {
        // Cache for 2 minutes, allow stale content for 5 minutes while revalidating
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy bulk history to API server:', error);

    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch bulk historical data',
        data: {},
        count: 0,
      },
      { status: 500 }
    );
  }
}
