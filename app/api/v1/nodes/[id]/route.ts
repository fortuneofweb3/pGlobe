/**
 * Public API v1: Get single node by ID/pubkey
 * GET /api/v1/nodes/:id
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';
import { getNodeByPubkey } from '@/lib/server/mongodb-nodes';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  return withAPIAuth(async (req: Request, { apiKey }) => {
    try {
      const nodeId = id;
    
    const node = await getNodeByPubkey(nodeId);
    
    if (!node) {
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404 }
      );
    }

    // Format response (exclude internal fields)
    const formattedNode = {
      id: node.id,
      pubkey: node.pubkey || node.publicKey,
      address: node.address,
      version: node.version,
      status: node.status,
      uptime: node.uptime,
      cpuPercent: node.cpuPercent,
      ramUsed: node.ramUsed,
      ramTotal: node.ramTotal,
      storageCapacity: node.storageCapacity,
      storageUsed: node.storageUsed,
      storageCommitted: node.storageCommitted,
      storageUsagePercent: node.storageUsagePercent,
      packetsReceived: node.packetsReceived,
      packetsSent: node.packetsSent,
      activeStreams: node.activeStreams,
      latency: node.latency,
      location: node.location,
      locationData: node.locationData,
      lastSeen: node.lastSeen,
      peerCount: node.peerCount,
      balance: node.balance,
      isPublic: node.isPublic,
      rpcPort: node.rpcPort,
      dataOperationsHandled: node.dataOperationsHandled,
      totalPages: node.totalPages,
    };

    return NextResponse.json({
      success: true,
      data: formattedNode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch node' },
      { status: 500 }
    );
  }
  })(request);
}

