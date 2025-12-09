import { NextResponse } from 'next/server';
import { fetchPNodesFromGossip, getMockPNodes } from '@/lib/server/prpc';
import { PNode } from '@/lib/types/pnode';
import { getNetworkConfig } from '@/lib/server/network-config';
import { upsertNodes, getAllNodes, getNodeByPubkey } from '@/lib/server/mongodb-nodes';
import { batchFetchLocations } from '@/lib/server/location-cache';
import { fetchBalanceForPubkey } from '@/lib/server/balance-cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('network');
    const useMock = searchParams.get('mock') === 'true';
    const refresh = searchParams.get('refresh') === 'true'; // Force refresh from gossip

    let nodes: PNode[];

    if (!useMock) {
      try {
        // FAST PATH: If refresh=false, just return from MongoDB immediately
        // Background task handles all the gossip fetching and enrichment
        if (!refresh) {
          // Fast path - just get from MongoDB
          try {
            console.log('[API] Fetching nodes from MongoDB (fast path)...');
            nodes = await getAllNodes();
            console.log(`[API] Retrieved ${nodes.length} nodes from MongoDB`);
            // If getAllNodes returns empty array, it might be a connection issue
            if (nodes.length === 0) {
              console.warn('[API] ⚠️ getAllNodes returned empty array - MongoDB might be empty or connection issue');
              console.warn('[API] MongoDB URI set:', !!process.env.MONGODB_URI);
            }
          } catch (dbError: any) {
            console.error('[API] ❌ MongoDB error in getAllNodes:', dbError?.message || dbError);
            console.error('[API] Stack:', dbError?.stack);
            // Return empty array instead of crashing
            nodes = [];
          }
        } else {
          // SLOW PATH: Only do full refresh if explicitly requested
          const customEndpoint = searchParams.get('endpoint') || process.env.NEXT_PUBLIC_PRPC_ENDPOINT;
          
          // If network ID provided, use that network's RPC URL
          let endpointToUse = customEndpoint;
          if (networkId && !customEndpoint) {
            const networkConfig = getNetworkConfig(networkId);
            if (networkConfig) {
              endpointToUse = networkConfig.rpcUrl;
            }
          }

          // STEP 1: Fetch nodes from gossip
          const gossipNodes = await fetchPNodesFromGossip(endpointToUse || undefined, false);
          
          // STEP 2: Store nodes in MongoDB (no duplicates - pubkey is primary key)
          await upsertNodes(gossipNodes);
          
          // STEP 3: Fetch geo location data for nodes missing it
          const nodesNeedingGeo: PNode[] = [];
          const geoMap = new Map<string, any>();
          
          for (const node of gossipNodes) {
            const ip = node.address?.split(':')[0];
            if (!ip || !ip.match(/^\d+\.\d+\.\d+\.\d+$/)) continue;
            
            if (!node.locationData?.lat || !node.locationData?.lon) {
              nodesNeedingGeo.push(node);
            } else {
              geoMap.set(ip, node.locationData);
            }
          }
          
          if (nodesNeedingGeo.length > 0) {
            const ipsToFetch = [...new Set(nodesNeedingGeo.map(n => n.address?.split(':')[0]).filter(Boolean))] as string[];
            const fetchedGeo = await batchFetchLocations(ipsToFetch);
            fetchedGeo.forEach((geo, ip) => geoMap.set(ip, geo));
          }
          
          // STEP 4: Fetch on-chain data to check registration status
          const allPubkeys = [...new Set(gossipNodes.map(node => node.pubkey || node.publicKey).filter(pk => pk))] as string[];
          const balanceMap = new Map<string, any>();
        
          for (const pk of allPubkeys) {
            const balanceData = await fetchBalanceForPubkey(pk);
            if (balanceData) balanceMap.set(pk, balanceData);
          }
          
          // STEP 5: Build enriched nodes and update MongoDB
          const enrichedNodes = gossipNodes.map(node => {
            const pk = node.pubkey || node.publicKey;
            const ip = node.address?.split(':')[0];
            const balanceData = pk ? balanceMap.get(pk) : null;
            const geoData = ip ? geoMap.get(ip) : null;
          
            return {
              ...node,
              ...(geoData ? {
                location: geoData.city ? `${geoData.city}, ${geoData.country}` : geoData.country,
                locationData: {
                  lat: geoData.lat,
                  lon: geoData.lon,
                  city: geoData.city,
                  country: geoData.country,
                  countryCode: geoData.countryCode,
                },
              } : {}),
              isRegistered: balanceData?.isRegistered ?? false,
              ...(balanceData ? {
                balance: balanceData.balance,
                managerPDA: balanceData.managerPDA,
              } : {}),
            };
          });
          
          await upsertNodes(enrichedNodes);
          
          // Return fresh nodes from MongoDB
          nodes = await getAllNodes();
        }
      } catch (error) {
        console.error('[API] Error:', error);
        nodes = [];
      }
    } else {
      nodes = getMockPNodes();
    }

    // Add cache headers for faster subsequent loads
    return NextResponse.json(
      { nodes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    console.error('[API] Fatal error:', error?.message || error);
    
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch nodes',
        nodes: [],
        timestamp: Date.now(),
        totalNodes: 0,
      },
      { status: 500 }
    );
  }
}
