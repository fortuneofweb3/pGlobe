/**
 * API endpoint to get client's location
 * Detects client IP from request headers and returns location
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedLocation, batchFetchLocations } from '@/lib/server/location-cache';

/**
 * Extract client IP from request headers
 * Handles Vercel, Cloudflare, and other proxy headers
 */
function getClientIP(request: NextRequest): string | null {
  // Check various headers for client IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || null;
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to connection remote address (if available)
  const remoteAddr = request.headers.get('x-vercel-forwarded-for');
  if (remoteAddr) {
    return remoteAddr;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Get client IP from request headers
    const clientIP = getClientIP(request);
    
    if (!clientIP) {
      return NextResponse.json(
        { error: 'Could not detect client IP address' },
        { status: 400 }
      );
    }

    console.log('[ClientLocation] Detected client IP:', clientIP);

    // Check cache first
    const cachedGeo = getCachedLocation(clientIP);
    if (cachedGeo) {
      console.log('[ClientLocation] Using cached location:', cachedGeo);
      return NextResponse.json({
        ip: clientIP,
        location: cachedGeo,
      });
    }

    // Fetch from external API
    let geo: any = null;
    try {
      const geoMapPromise = batchFetchLocations([clientIP]);
      const timeoutPromise = new Promise<Map<string, any>>((_, reject) => 
        setTimeout(() => reject(new Error('Geo API timeout')), 5000)
      );
      
      const geoMap = await Promise.race([geoMapPromise, timeoutPromise]);
      geo = geoMap.get(clientIP);
    } catch (err: any) {
      console.error(`[ClientLocation] External fetch failed for ${clientIP}:`, err.message);
      return NextResponse.json(
        { error: 'Geo service timeout - please try again' },
        { status: 504 }
      );
    }

    if (!geo || !geo.lat || !geo.lon) {
      return NextResponse.json(
        { error: 'Could not fetch geo location' },
        { status: 404 }
      );
    }

    console.log('[ClientLocation] Fetched location:', {
      ip: clientIP,
      lat: geo.lat,
      lon: geo.lon,
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode,
    });

    return NextResponse.json({
      ip: clientIP,
      location: {
        lat: geo.lat,
        lon: geo.lon,
        city: geo.city,
        country: geo.country,
        countryCode: geo.countryCode,
      },
    });
  } catch (error: any) {
    console.error('[ClientLocation] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to detect client location' },
      { status: 500 }
    );
  }
}

