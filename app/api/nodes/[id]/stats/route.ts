/**
 * Get node stats - all data is now stored in MongoDB and updated every 1 minute
 * No on-demand fetching needed
 */

import { NextResponse } from 'next/server';
import { getNodeByPubkey } from '@/lib/server/mongodb-nodes';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    
    // Get all data from MongoDB (updated every 1 minute from gossip)
    const node = await getNodeByPubkey(nodeId);
    
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
              }
    
    // Return all data from MongoDB
    return NextResponse.json({
      success: true,
      data: {
        // All data from MongoDB (updated every 1 minute)
        pubkey: node.pubkey || node.publicKey,
        address: node.address,
        version: node.version,
        status: node.status || 'offline',
        uptime: node.uptime,
        cpuPercent: node.cpuPercent,
        ramUsed: node.ramUsed,
        ramTotal: node.ramTotal,
        packetsReceived: node.packetsReceived,
        packetsSent: node.packetsSent,
        activeStreams: node.activeStreams,
        latency: node.latency,
        storageCapacity: node.storageCapacity,
        storageUsed: node.storageUsed,
        storageCommitted: node.storageCommitted,
        storageUsagePercent: node.storageUsagePercent,
        isPublic: node.isPublic,
        rpcPort: node.rpcPort,
        peerCount: node.peerCount,
        balance: node.balance,
        isRegistered: node.isRegistered,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch node stats' },
      { status: 500 }
    );
  }
}
