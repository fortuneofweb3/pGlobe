/**
 * Public API v1: Network statistics
 * GET /api/v1/network/stats
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';
import { getAllNodes } from '@/lib/server/mongodb-nodes';

export const GET = withAPIAuth(async (request: Request) => {
  try {
    const nodes = await getAllNodes();
    
    if (nodes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No nodes found',
      }, { status: 404 });
    }

    // Aggregate statistics
    const stats = {
      totalNodes: nodes.length,
      totalStorage: nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0),
      totalRAM: nodes.reduce((sum, n) => sum + (n.ramTotal || 0), 0),
      totalPacketsReceived: nodes.reduce((sum, n) => sum + (n.packetsReceived || 0), 0),
      totalPacketsSent: nodes.reduce((sum, n) => sum + (n.packetsSent || 0), 0),
      totalDataOperations: nodes.reduce((sum, n) => sum + (n.dataOperationsHandled || 0), 0),
      totalPeers: nodes.reduce((sum, n) => sum + (n.peerCount || 0), 0),
      publicNodes: nodes.filter(n => n.isPublic).length,
      uniqueCountries: new Set(nodes.map(n => n.locationData?.countryCode).filter(Boolean)).size,
      uniqueVersions: new Set(nodes.map(n => n.version).filter(Boolean)).size,
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch network stats' },
      { status: 500 }
    );
  }
});

