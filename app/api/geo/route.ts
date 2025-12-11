/**
 * Get geo location from MongoDB or fetch if missing
 */

import { NextResponse } from 'next/server';
import { batchFetchLocations, getCachedLocation } from '@/lib/server/location-cache';
import { upsertNodes, getNodesCollection, documentToNode } from '@/lib/server/mongodb-nodes';
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
    
    // Check MongoDB for node with this IP (optimized direct query - much faster than getAllNodes)
    let nodeWithIP: PNode | undefined;
    try {
      // Direct MongoDB query by IP - much faster than fetching all nodes
      const collection = await getNodesCollection();
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('MongoDB query timeout')), 2000)
      );
      
      const docPromise = collection.findOne({ 
        $or: [
          { ipAddress: ip },
          { address: { $regex: `^${ip}:` } }
        ]
      });
      
      const doc = await Promise.race([docPromise, timeoutPromise]);
      
      if (doc) {
        nodeWithIP = documentToNode(doc as any);
      }
    } catch (err: any) {
      // MongoDB query timed out or failed - skip and use external API
      // This is fine - we'll fetch from ip-api.com instead
      console.debug(`[Geo API] MongoDB lookup for ${ip} failed:`, err.message);
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
    
    // Fetch from external API (with timeout protection - 10 seconds)
    let geo: any = null;
    try {
      const geoMapPromise = batchFetchLocations([ip]);
      const timeoutPromise = new Promise<Map<string, any>>((_, reject) => 
        setTimeout(() => reject(new Error('Geo API timeout')), 10000)
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

