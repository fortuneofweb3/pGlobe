/**
 * Server-side background task to refresh MongoDB with gossip data every minute
 * Runs independently of client connections
 */

import { fetchPNodesFromGossip } from './prpc';
import { upsertNodes, cleanupInvalidNodes } from './mongodb-nodes';
import { batchFetchLocations } from './location-cache';
import { fetchBalanceForPubkey } from './balance-cache';
import { getNetworkConfig } from './network-config';
import { PNode } from '../types/pnode';

let refreshInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Perform a single refresh cycle
 */
async function performRefresh(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log(`[BackgroundRefresh] Starting refresh...`);
    
    // Get default network config
    const networkConfig = getNetworkConfig('devnet1');
    const endpoint = networkConfig?.rpcUrl || process.env.NEXT_PUBLIC_PRPC_ENDPOINT;

    // STEP 1: Fetch nodes from gossip (includes get-pods-with-stats + get-stats enrichment)
    // fetchPNodesFromGossip already enriches nodes with detailed stats (CPU, RAM, packets) via get-stats
    console.log(`[BackgroundRefresh] Fetching nodes from gossip...`);
    const gossipNodes = await fetchPNodesFromGossip(endpoint, false);
    console.log(`[BackgroundRefresh] Fetched ${gossipNodes.length} nodes from gossip`);
    
    if (gossipNodes.length === 0) {
      console.log(`[BackgroundRefresh] No nodes found, skipping`);
      return;
    }

    // Log version distribution before filtering
    const versionCounts = new Map<string, number>();
    gossipNodes.forEach(node => {
      const version = node.version || 'unknown';
      versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
    });
    console.log(`[BackgroundRefresh] Version distribution: ${Array.from(versionCounts.entries()).map(([v, c]) => `${v}:${c}`).join(', ')}`);

    // Filter nodes that have VALID pubkeys (required - no longer accepting IP-only nodes)
    const { isValidPubkey } = await import('./mongodb-nodes');
    const nodesWithValidPubkeys = gossipNodes.filter(node => {
      const pubkey = node.pubkey || node.publicKey || '';
      return isValidPubkey(pubkey);
    });
    const nodesWithoutValidPubkey = gossipNodes.length - nodesWithValidPubkeys.length;
    if (nodesWithoutValidPubkey > 0) {
      console.log(`[BackgroundRefresh] ⚠️  ${nodesWithoutValidPubkey} nodes filtered out (invalid or missing pubkey)`);
    }
    console.log(`[BackgroundRefresh] ${nodesWithValidPubkeys.length}/${gossipNodes.length} nodes have valid pubkey`);
    
    // Log version distribution after filtering
    const versionCountsWithPubkeys = new Map<string, number>();
    nodesWithValidPubkeys.forEach(node => {
      const version = node.version || 'unknown';
      versionCountsWithPubkeys.set(version, (versionCountsWithPubkeys.get(version) || 0) + 1);
    });
    console.log(`[BackgroundRefresh] Version distribution (with valid pubkeys): ${Array.from(versionCountsWithPubkeys.entries()).map(([v, c]) => `${v}:${c}`).join(', ')}`);

    if (nodesWithValidPubkeys.length === 0) {
      console.log(`[BackgroundRefresh] No nodes with valid pubkeys, skipping MongoDB write`);
      return;
    }

    // STEP 2: Store nodes in MongoDB (no duplicates - pubkey is primary key)
    // Nodes already have all stats (uptime, CPU, RAM, packets) from fetchPNodesFromGossip
    console.log(`[BackgroundRefresh] Storing ${nodesWithValidPubkeys.length} nodes in MongoDB...`);
    try {
      await upsertNodes(nodesWithValidPubkeys);
      console.log(`[BackgroundRefresh] ✅ Stored nodes in MongoDB`);
    } catch (error: any) {
      console.error(`[BackgroundRefresh] ⚠️  Failed to store nodes in MongoDB: ${error?.message || error}`);
      console.error(`[BackgroundRefresh] Continuing with geo/balance enrichment...`);
      // Continue with enrichment even if MongoDB write failed
    }

    // STEP 3: Fetch geo location data for nodes missing it
    const nodesNeedingGeo: PNode[] = [];
    const geoMap = new Map<string, any>();

    for (const node of nodesWithValidPubkeys) {
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
      console.log(`[BackgroundRefresh] Fetching geo for ${ipsToFetch.length} IPs...`);
      const fetchedGeo = await batchFetchLocations(ipsToFetch);
      fetchedGeo.forEach((geo, ip) => geoMap.set(ip, geo));
      console.log(`[BackgroundRefresh] Fetched geo for ${fetchedGeo.size} IPs`);
    }

    // STEP 4: Fetch on-chain data to check registration status
    const allPubkeys = [...new Set(nodesWithValidPubkeys.map(node => node.pubkey || node.publicKey).filter(pk => pk))] as string[];
    console.log(`[BackgroundRefresh] Fetching on-chain data for ${allPubkeys.length} pubkeys...`);
    const balanceMap = new Map<string, any>();

    for (const pk of allPubkeys) {
      try {
        const balanceData = await fetchBalanceForPubkey(pk);
        if (balanceData) {
          balanceMap.set(pk, balanceData);
          if (balanceData.balance > 0) {
            console.log(`[BackgroundRefresh] Found balance for ${pk.substring(0, 8)}...: ${balanceData.balance} SOL`);
          }
        }
      } catch (e) {
        // Silent fail for individual balance fetches
        console.warn(`[BackgroundRefresh] Failed to fetch balance for ${pk.substring(0, 8)}...:`, e instanceof Error ? e.message : String(e));
      }
    }
    const nodesWithBalance = Array.from(balanceMap.values()).filter(b => b.balance > 0).length;
    console.log(`[BackgroundRefresh] Fetched on-chain data for ${balanceMap.size}/${allPubkeys.length} pubkeys (${nodesWithBalance} with balance > 0)`);

    // STEP 5: Re-enrich nodes with null values (especially those with uptime but missing stats)
    // Fetch existing nodes to check for null values that need enrichment
    const { getAllNodes } = await import('./mongodb-nodes');
    const existingNodesMap = new Map<string, PNode>();
    const nodesNeedingReEnrichment: PNode[] = [];
    
    try {
      const existingNodes = await getAllNodes();
      existingNodes.forEach(node => {
        const key = node.pubkey || node.publicKey;
        if (key) existingNodesMap.set(key, node);
        
        // Check if node needs re-enrichment (has uptime but missing CPU/RAM/packets)
        // This indicates the node might be online but stats fetch failed previously
        const needsEnrichment = (
          (node.uptime !== undefined && node.uptime !== null && node.uptime > 0) || // Has uptime
          node.status === 'online' || // Marked as online
          node.version // Has version (likely active)
        ) && (
          node.cpuPercent === null || node.cpuPercent === undefined ||
          node.ramTotal === null || node.ramTotal === undefined ||
          node.ramUsed === null || node.ramUsed === undefined ||
          node.packetsReceived === null || node.packetsReceived === undefined ||
          node.packetsSent === null || node.packetsSent === undefined ||
          node.activeStreams === null || node.activeStreams === undefined
        );
        
        if (needsEnrichment && node.address) {
          nodesNeedingReEnrichment.push(node);
        }
      });
      
      if (nodesNeedingReEnrichment.length > 0) {
        console.log(`[BackgroundRefresh] Found ${nodesNeedingReEnrichment.length} nodes with null stats that need re-enrichment...`);
      }
    } catch (e) {
      console.warn('[BackgroundRefresh] Could not fetch existing nodes, will use balance data only');
    }
    
    // Re-enrich nodes with null values
    if (nodesNeedingReEnrichment.length > 0) {
      const { fetchNodeStats } = await import('./prpc');
      const { isValidPubkey } = await import('./mongodb-nodes');
      const BATCH_SIZE = 10; // Smaller batch for re-enrichment
      let reEnrichedCount = 0;
      
      console.log(`[BackgroundRefresh] Re-enriching ${nodesNeedingReEnrichment.length} nodes with null stats...`);
      
      for (let i = 0; i < nodesNeedingReEnrichment.length; i += BATCH_SIZE) {
        const batch = nodesNeedingReEnrichment.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(node => fetchNodeStats(node))
        );
        
        // Update nodesWithValidPubkeys with re-enriched data
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled') {
            const enriched = (results[j] as PromiseFulfilledResult<PNode>).value;
            const originalNode = batch[j];
            
            // Check if we got new data
            const gotNewData = (
              (enriched.cpuPercent !== null && enriched.cpuPercent !== undefined && originalNode.cpuPercent === null) ||
              (enriched.ramTotal !== null && enriched.ramTotal !== undefined && originalNode.ramTotal === null) ||
              (enriched.ramUsed !== null && enriched.ramUsed !== undefined && originalNode.ramUsed === null) ||
              (enriched.packetsReceived !== null && enriched.packetsReceived !== undefined && originalNode.packetsReceived === null) ||
              (enriched.packetsSent !== null && enriched.packetsSent !== undefined && originalNode.packetsSent === null) ||
              (enriched.activeStreams !== null && enriched.activeStreams !== undefined && originalNode.activeStreams === null)
            );
            
            if (gotNewData) {
              // Find and update the node in nodesWithValidPubkeys
              const key = originalNode.pubkey || originalNode.publicKey || originalNode.address?.split(':')[0];
              const index = nodesWithValidPubkeys.findIndex(n => {
                const nKey = n.pubkey || n.publicKey || n.address?.split(':')[0];
                return nKey === key;
              });
              
              if (index >= 0) {
                // Merge enriched data, preserving existing non-null values
                nodesWithValidPubkeys[index] = {
                  ...nodesWithValidPubkeys[index],
                  cpuPercent: enriched.cpuPercent ?? nodesWithValidPubkeys[index].cpuPercent,
                  ramUsed: enriched.ramUsed ?? nodesWithValidPubkeys[index].ramUsed,
                  ramTotal: enriched.ramTotal ?? nodesWithValidPubkeys[index].ramTotal,
                  packetsReceived: enriched.packetsReceived ?? nodesWithValidPubkeys[index].packetsReceived,
                  packetsSent: enriched.packetsSent ?? nodesWithValidPubkeys[index].packetsSent,
                  activeStreams: enriched.activeStreams ?? nodesWithValidPubkeys[index].activeStreams,
                  uptime: enriched.uptime ?? nodesWithValidPubkeys[index].uptime,
                  latency: enriched.latency ?? nodesWithValidPubkeys[index].latency,
                  status: enriched.status ?? nodesWithValidPubkeys[index].status,
                };
                reEnrichedCount++;
              } else {
                // Node not in current gossip, but we enriched it - only add if it has valid pubkey
                const enrichedPubkey = enriched.pubkey || enriched.publicKey;
                if (enrichedPubkey && isValidPubkey(enrichedPubkey)) {
                  nodesWithValidPubkeys.push(enriched);
                  reEnrichedCount++;
                }
              }
            }
          }
        }
      }
      
      if (reEnrichedCount > 0) {
        console.log(`[BackgroundRefresh] ✅ Re-enriched ${reEnrichedCount} nodes with previously null stats`);
      } else {
        console.log(`[BackgroundRefresh] ⚠️  Attempted to re-enrich ${nodesNeedingReEnrichment.length} nodes but got no new data (nodes may be offline or pRPC not accessible)`);
      }
    }

    const enrichedNodes = nodesWithValidPubkeys.map(node => {
      const pk = node.pubkey || node.publicKey;
      const ip = node.address?.split(':')[0];
      const balanceData = pk ? balanceMap.get(pk) : null;
      const geoData = ip ? geoMap.get(ip) : null;
      const existingNode = pk ? existingNodesMap.get(pk) : null;

      // Determine isRegistered: always use balance > 0 during sync (per user requirement: "if a node has a balance then it is registered")
      // Update isRegistered based on actual balance data, not preserve old values
      let isRegistered: boolean;
      if (balanceData) {
        // If node has balance > 0, it's registered
        isRegistered = balanceData.balance > 0;
      } else {
        // If balance fetch failed, check existing balance from MongoDB
        const existingBalance = existingNode?.balance;
        if (existingBalance !== undefined && existingBalance !== null) {
          // Use existing balance to determine registration
          isRegistered = existingBalance > 0;
        } else {
          // No balance data at all - mark as unregistered
          isRegistered = false;
        }
      }

      // Build enriched node from gossip data (gossip nodes don't have balance - that comes from on-chain)
      // IMPORTANT: Use ALL fresh data from node (gossip + stats) - don't preserve old stats
      // This ensures activeStreams, cpuPercent, ramUsed, etc. are always updated
      const enrichedNode: PNode = {
        ...node, // This includes all fresh stats from gossip (activeStreams, cpuPercent, ramUsed, packetsReceived, packetsSent, etc.)
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
      };

      // Balance comes from on-chain fetch, not gossip
      // Set balance/managerPDA: fresh on-chain data takes priority, otherwise preserve existing from MongoDB
      if (balanceData) {
        // Use fresh on-chain balance data
        enrichedNode.balance = balanceData.balance;
        if (balanceData.managerPDA) {
          enrichedNode.managerPDA = balanceData.managerPDA;
        }
      } else if (existingNode) {
        // On-chain fetch failed - preserve existing balance and managerPDA from MongoDB
        // This is critical: balance only exists from previous on-chain fetches, not from gossip
        if (existingNode.balance !== undefined && existingNode.balance !== null) {
          enrichedNode.balance = existingNode.balance;
        }
        if (existingNode.managerPDA) {
          enrichedNode.managerPDA = existingNode.managerPDA;
        }
      }
      // If no on-chain data and no existing node, balance will be undefined (new node, no balance yet)

      // Always set isRegistered based on balance (update during sync)
      enrichedNode.isRegistered = isRegistered;

      return enrichedNode;
    });

    console.log(`[BackgroundRefresh] Updating MongoDB with enriched data...`);
    try {
      await upsertNodes(enrichedNodes);
      
      // Check final count after update
      let finalCount = 0;
      try {
        const finalNodes = await getAllNodes();
        finalCount = finalNodes.length;
      } catch (e) {
        // Ignore error
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`[BackgroundRefresh] ✅ Updated ${enrichedNodes.length} nodes in MongoDB (${totalTime}ms)`);
      console.log(`[BackgroundRefresh] 📊 Database now has ${finalCount} total nodes (${enrichedNodes.length} from this refresh)`);
      
      if (finalCount > enrichedNodes.length) {
        const offlineCount = finalCount - enrichedNodes.length;
        console.log(`[BackgroundRefresh] ℹ️  ${offlineCount} nodes in database are not currently in gossip network (may be offline)`);
      }
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`[BackgroundRefresh] ⚠️  Failed to update MongoDB: ${error?.message || error} (${totalTime}ms)`);
      // Don't throw - allow refresh cycle to complete, will retry next cycle
    }
  } catch (error: any) {
    console.error(`[BackgroundRefresh] ❌ Error:`, error?.message || error);
    console.error(error?.stack);
  } finally {
    // Clean up invalid nodes every refresh - remove nodes without valid pubkeys
    try {
      const deletedCount = await cleanupInvalidNodes();
      if (deletedCount > 0) {
        console.log(`[BackgroundRefresh] 🧹 Cleaned up ${deletedCount} nodes with invalid pubkeys`);
      }
    } catch (cleanupError: any) {
      console.error(`[BackgroundRefresh] Error during cleanup:`, cleanupError?.message || cleanupError);
    }
    
    isRunning = false;
  }
}

/**
 * Start the background refresh task (runs every 1 minute)
 */
export function startBackgroundRefresh(): void {
  if (refreshInterval) return;

  // Perform initial refresh immediately
  performRefresh().catch(err => {
    console.error('[BackgroundRefresh] Error:', err);
  });

  // Then set up interval for every 1 minute (60000ms)
  refreshInterval = setInterval(() => {
    performRefresh().catch(err => {
      console.error('[BackgroundRefresh] Error:', err);
    });
  }, 60 * 1000); // 1 minute
}

/**
 * Stop the background refresh task
 */
export function stopBackgroundRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

