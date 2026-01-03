
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

    // Create AbortController for timeout
    // Increased timeout to 60 seconds for bulk requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          ...data,
          error: data.error || data.message || 'Failed to fetch bulk historical data',
        },
        { status: response.status }
      );
    }

    // Return exact data from backend (no downsampling) to match production behavior
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
