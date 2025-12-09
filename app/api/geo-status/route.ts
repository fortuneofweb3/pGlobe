import { NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';

export async function GET() {
  try {
    const nodes = await getAllNodes();
    
    const withoutGeo = nodes.filter(n => !n.locationData?.lat || !n.locationData?.lon);
    
    const details = withoutGeo.map(n => ({
      address: n.address,
      ipAddress: n.address?.split(':')[0],
      pubkey: (n.pubkey || n.publicKey)?.substring(0, 20) + '...',
      hasLat: !!n.locationData?.lat,
      hasLon: !!n.locationData?.lon,
    }));
    
    return NextResponse.json({
      total: nodes.length,
      withGeo: nodes.filter(n => n.locationData?.lat && n.locationData?.lon).length,
      withoutGeo: withoutGeo.length,
      nodesWithoutGeo: details,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

