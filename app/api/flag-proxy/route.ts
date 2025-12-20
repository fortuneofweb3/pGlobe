import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route for flag images with permanent caching
 * This ensures flags are cached forever in the browser
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countryCode = searchParams.get('code');
  
  if (!countryCode) {
    return new NextResponse('Missing country code', { status: 400 });
  }

  try {
    const flagUrl = `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
    
    const response = await fetch(flagUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      return new NextResponse('Flag not found', { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Return with permanent cache headers (1 year = max practical cache)
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year, immutable
        'Expires': new Date(Date.now() + 31536000 * 1000).toUTCString(),
      },
    });
  } catch (error) {
    console.error('[Flag Proxy] Error fetching flag:', error);
    return new NextResponse('Failed to fetch flag', { status: 500 });
  }
}

