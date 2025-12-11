/**
 * API endpoint to get server location
 * Returns the geographic location and region of the server
 */

import { NextResponse } from 'next/server';
import { getServerRegion, detectServerLocation } from '@/lib/server/server-location';

export async function GET() {
  try {
    const serverLocation = await detectServerLocation();
    const serverRegion = await getServerRegion();
    
    return NextResponse.json({
      location: serverLocation,
      region: {
        id: serverRegion.id,
        name: serverRegion.name,
      },
    });
  } catch (error: any) {
    console.error('[API ServerLocation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect server location' },
      { status: 500 }
    );
  }
}

