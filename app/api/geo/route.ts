/**
 * Get geo location from MongoDB or fetch if missing
 */

import { NextResponse } from 'next/server';
import { batchFetchLocations, getCachedLocation } from '@/lib/server/location-cache';
import { upsertNodes, getAllNodes } from '@/lib/server/mongodb-nodes';
import { PNode } from '@/lib/types/pnode';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get('ip');
    
    if (!ip) {
      return NextResponse.json(
        { error: 'ip parameter required' },
        { status: 400 }
      );
    }
    
    // First check in-memory cache (fastest - instant)
    const cachedGeo = getCachedLocation(ip);
    if (cachedGeo) {
      return NextResponse.json(cachedGeo);
    }
    
    // Check MongoDB for node with this IP (skip if slow - use external API instead)
    // We'll try a quick lookup but won't block if it's slow
    let nodeWithIP: PNode | undefined;
    try {
      // Use a shorter timeout for geo lookups - don't block the main data flow
      const nodesPromise = getAllNodes();
      const timeoutPromise = new Promise<PNode[]>((_, reject) => 
        setTimeout(() => reject(new Error('MongoDB query timeout')), 2000)
      );
      
      const nodes = await Promise.race([nodesPromise, timeoutPromise]);
      
      nodeWithIP = nodes.find(n => {
        const nodeIp = n.address?.split(':')[0];
        return nodeIp === ip;
      });
    } catch (err: any) {
      // MongoDB query timed out or failed - skip and use external API
      // This is fine - we'll fetch from ip-api.com instead
    }
    
    if (nodeWithIP?.locationData?.lat && nodeWithIP?.locationData?.lon) {
      // Return from MongoDB
      return NextResponse.json({
        lat: nodeWithIP.locationData.lat,
        lon: nodeWithIP.locationData.lon,
        city: nodeWithIP.locationData.city,
        country: nodeWithIP.locationData.country,
        countryCode: nodeWithIP.locationData.countryCode,
      });
    }
    
    // Fetch from external API (with timeout protection - 5 seconds)
    let geo: any = null;
    try {
      const geoMapPromise = batchFetchLocations([ip]);
      const timeoutPromise = new Promise<Map<string, any>>((_, reject) => 
        setTimeout(() => reject(new Error('Geo API timeout')), 5000)
      );
      
      const geoMap = await Promise.race([geoMapPromise, timeoutPromise]);
      geo = geoMap.get(ip);
    } catch (err: any) {
      // External API timed out or failed
      console.error(`[Geo API] External fetch failed for ${ip}:`, err.message);
      return NextResponse.json(
        { error: 'Geo service timeout - please try again' },
        { status: 504 }
      );
    }
    
    if (geo) {
      // Update node in MongoDB with geo data if we found one (async, don't wait)
      if (nodeWithIP) {
        const updatedNode = {
          ...nodeWithIP,
          location: geo.city ? `${geo.city}, ${geo.country}` : geo.country,
          locationData: {
            lat: geo.lat,
            lon: geo.lon,
            city: geo.city,
            country: geo.country,
            countryCode: geo.countryCode,
          },
        };
        // Don't await - update in background
        upsertNodes([updatedNode]).catch(err => 
          console.warn(`[Geo API] Failed to update node in DB:`, err)
        );
      }
      
      return NextResponse.json(geo);
    }
    
    return NextResponse.json(
      { error: 'Could not fetch geo location' },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch geo location' },
      { status: 500 }
    );
  }
}

