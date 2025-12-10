/**
 * Public API v1: List all nodes
 * GET /api/v1/nodes
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { PNode } from '@/lib/types/pnode';

export const GET = withAPIAuth(async (request: Request, { apiKey }) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get all nodes
    let nodes = await getAllNodes();

    // Apply filters
    const status = searchParams.get('status');
    if (status) {
      nodes = nodes.filter(n => n.status === status);
    }

    const version = searchParams.get('version');
    if (version) {
      nodes = nodes.filter(n => n.version === version);
    }

    const country = searchParams.get('country');
    if (country) {
      nodes = nodes.filter(n => n.locationData?.countryCode === country || n.locationData?.country === country);
    }

    const minUptime = searchParams.get('min_uptime');
    if (minUptime) {
      const min = parseFloat(minUptime);
      nodes = nodes.filter(n => n.uptime !== undefined && n.uptime >= min);
    }

    const minStorage = searchParams.get('min_storage');
    if (minStorage) {
      const min = parseInt(minStorage);
      nodes = nodes.filter(n => n.storageCapacity !== undefined && n.storageCapacity >= min);
    }

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'uptime';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    
    nodes.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000); // Max 1000 per page
    const offset = (page - 1) * limit;
    const paginatedNodes = nodes.slice(offset, offset + limit);

    // Format response (exclude internal fields)
    const formattedNodes = paginatedNodes.map(node => formatNodeForAPI(node));

    return NextResponse.json({
      success: true,
      data: formattedNodes,
      meta: {
        total: nodes.length,
        page,
        limit,
        totalPages: Math.ceil(nodes.length / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
});

/**
 * Format node data for API response (exclude internal fields)
 */
function formatNodeForAPI(node: PNode): any {
  return {
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
  };
}

