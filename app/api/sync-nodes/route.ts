/**
 * API endpoint to sync node data to database
 * Fetches fresh data from pRPC/gossip and stores static data in SQLite
 */

import { NextResponse } from 'next/server';
import { fetchPNodesFromGossip } from '@/lib/server/prpc';
import { upsertNodes, getAllNodes } from '@/lib/server/mongodb-nodes';
import { getNetworkConfig } from '@/lib/server/network-config';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('network') || 'devnet1';
    const force = searchParams.get('force') === 'true';
    
    const networkConfig = getNetworkConfig(networkId);
    if (!networkConfig) {
      return NextResponse.json(
        { error: `Network ${networkId} not found` },
        { status: 400 }
      );
    }

    console.log(`[Sync] Starting sync for network: ${networkConfig.name}`);

    // Fetch fresh node data from pRPC/gossip
    const nodes = await fetchPNodesFromGossip(networkConfig.rpcUrl);
    console.log(`[Sync] Fetched ${nodes.length} nodes from gossip`);
    
    // Log first node to verify structure
    if (nodes.length > 0) {
      console.log(`[Sync] Sample node:`, JSON.stringify(nodes[0], null, 2).substring(0, 500));
    }

    // Bulk upsert to database
    let upserted = 0;
    let syncError = null;
    try {
      await upsertNodes(nodes);
      upserted = nodes.length;
      console.log(`[Sync] Upserted ${upserted} nodes to database`);
    } catch (upsertError: any) {
      console.error(`[Sync] Error during bulk upsert:`, upsertError);
      console.error(`[Sync] Error stack:`, upsertError.stack);
      syncError = upsertError.message || upsertError.toString();
    }

    // Get all nodes from database (with DB indexes)
    let dbNodes = [];
    try {
      dbNodes = await getAllNodes();
      console.log(`[Sync] Total nodes in database: ${dbNodes.length}`);
    } catch (getError: any) {
      console.error(`[Sync] Error getting nodes from database:`, getError);
      // Don't fail - we already upserted
    }

    return NextResponse.json({
      success: syncError ? false : true,
      fetched: nodes.length,
      upserted,
      totalInDB: dbNodes.length,
      message: syncError || `Synced ${upserted} nodes to database`,
      error: syncError,
    });
  } catch (error) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync nodes',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: Request) {
  try {
    const nodes = await getAllNodes();
    
    // Sample first few nodes with all data
    const sampleNodes = nodes.slice(0, 3).map(n => ({
      pubkey: n.pubkey?.substring(0, 20) + '...',
      address: n.address,
      location: n.location,
      locationCity: n.locationData?.city,
      locationCountry: n.locationData?.country,
      lat: n.locationData?.lat,
      lon: n.locationData?.lon,
      version: n.version,
      balance: n.balance,
    }));
    
    return NextResponse.json({
      totalNodes: nodes.length,
      withGeo: nodes.filter(n => n.locationData?.lat && n.locationData?.lon).length,
      withBalance: nodes.filter(n => n.balance !== null && n.balance !== undefined).length,
      sampleNodes,
    });
  } catch (error) {
    console.error('[Sync] Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

