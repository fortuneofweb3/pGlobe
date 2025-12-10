/**
 * Historical data endpoint - Proxies to API server (local in dev, Render in production)
 * 
 * API server handles:
 * - Reading historical snapshots from MongoDB
 * - Node-specific history queries
 * - Summary statistics
 */

import { NextResponse } from 'next/server';

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
    
    const url = `${RENDER_API_URL}/api/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    console.log('[VercelProxy] Proxying history request to API server:', url);
    
    // Create AbortController for timeout
    // Increased timeout to 45 seconds - MongoDB queries can take time with large datasets
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
        console.error('[VercelProxy] ❌ Request to API server timed out after 45 seconds');
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
      console.error('[VercelProxy] ❌ Failed to parse response as JSON:', parseError);
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
          error: data.error || 'Failed to fetch historical data',
        },
        { status: response.status }
      );
    }

    console.log(`[VercelProxy] ✅ Returning historical data from API server`);
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error: any) {
    console.error('[VercelProxy] ❌ Failed to proxy history to API server:', error);
    
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch historical data',
        data: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

