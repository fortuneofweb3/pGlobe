/**
 * Simplified Node Sync Service
 * 
 * Clean architecture:
 * 1. Fetch nodes from gossip (get-pods-with-stats)
 * 2. Enrich with detailed stats (get-stats) for CPU/RAM/packets
 * 3. Enrich with location data
 * 4. Enrich with credits
 * 5. Enrich with on-chain balance (for new nodes only)
 * 6. Deduplicate by pubkey (merge same pubkey with different IPs)
 * 7. Save to database
 */

import { PNode } from '@/lib/types/pnode';
import * as http from 'http';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROXY_RPC_ENDPOINTS = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

const DIRECT_PRPC_ENDPOINTS = [
  '173.212.203.145:6000',
  '173.212.220.65:6000',
  '161.97.97.41:6000',
  '192.190.136.36:6000',
  '192.190.136.37:6000',
  '192.190.136.38:6000',
  '192.190.136.28:6000',
  '192.190.136.29:6000',
  '207.244.255.1:6000',
  '173.249.59.66:6000',
  '173.249.54.191:6000',
];

const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function httpPost(url: string, data: object, timeoutMs: number = 5000): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? require('https') : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      };

      const req = httpModule.request(options, (res: any) => {
        let responseData = '';
        res.on('data', (chunk: any) => responseData += chunk.toString());
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(postData);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function isValidPubkey(pubkey: string | null | undefined): boolean {
  if (!pubkey || typeof pubkey !== 'string') return false;
  const trimmed = pubkey.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false;

  try {
    const { PublicKey } = require('@solana/web3.js');
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

function calculateStatus(lastSeenTimestamp: number | undefined): 'online' | 'offline' | 'syncing' {
  if (!lastSeenTimestamp) return 'offline';

  const lastSeen = lastSeenTimestamp > 1e12 ? lastSeenTimestamp : lastSeenTimestamp * 1000;
  const timeSinceLastSeen = Date.now() - lastSeen;

  if (timeSinceLastSeen < 5 * 60 * 1000) return 'online';
  if (timeSinceLastSeen < 60 * 60 * 1000) return 'syncing';
  return 'offline';
}

// ============================================================================
// STEP 1: FETCH NODES FROM GOSSIP
// ============================================================================

async function callPRPC(url: string, method: string, timeout: number = 10000): Promise<any | null> {
  const payload = { jsonrpc: '2.0', method, id: 1, params: [] };
  const response = await httpPost(url, payload, timeout);
  return response?.result || null;
}

interface RawPod {
  address?: string;
  pubkey?: string;
  publicKey?: string;
  version?: string;
  last_seen_timestamp?: number;
  uptime?: number;
  storage_committed?: number;
  storage_used?: number;
  total_pages?: number;
  data_operations_handled?: number;
  is_public?: boolean;
  rpc_port?: number;
  peer_count?: number;
}

function rawPodToNode(pod: RawPod, index: number): PNode | null {
  const pubkey = pod.pubkey || pod.publicKey || '';
  if (!isValidPubkey(pubkey)) return null;

  const address = pod.address || '';
  const status = calculateStatus(pod.last_seen_timestamp);
  const lastSeen = pod.last_seen_timestamp
    ? (pod.last_seen_timestamp > 1e12 ? pod.last_seen_timestamp : pod.last_seen_timestamp * 1000)
    : Date.now();

  return {
    id: pubkey,
    pubkey,
    publicKey: pubkey,
    address,
    version: pod.version || '',
    status,
    lastSeen,
    uptime: pod.uptime,
    storageCapacity: pod.storage_committed,
    storageUsed: pod.storage_used,
    totalPages: pod.total_pages,
    dataOperationsHandled: pod.data_operations_handled,
    isPublic: pod.is_public,
    rpcPort: pod.rpc_port,
    peerCount: pod.peer_count,
    seenInGossip: true,
  };
}

async function fetchNodesFromEndpoint(endpoint: string): Promise<PNode[]> {
  const url = endpoint.startsWith('http') ? endpoint : `http://${endpoint}/rpc`;

  // Try get-pods-with-stats first (v0.7.0+), fallback to get-pods
  let result = await callPRPC(url, 'get-pods-with-stats', 30000);
  if (!result) {
    result = await callPRPC(url, 'get-pods', 20000);
  }
  if (!result) return [];

  // Extract pods array from response
  const pods: RawPod[] = Array.isArray(result) ? result
    : result.pods || result.nodes || result.result?.pods || [];

  return pods.map((pod, i) => rawPodToNode(pod, i)).filter((n): n is PNode => n !== null);
}

export async function fetchAllNodes(): Promise<Map<string, PNode>> {
  const nodesMap = new Map<string, PNode>();

  console.log('[Sync] Fetching nodes from gossip endpoints...');

  // Query all endpoints in parallel
  const allEndpoints = [...PROXY_RPC_ENDPOINTS, ...DIRECT_PRPC_ENDPOINTS.map(e => `http://${e}/rpc`)];
  const results = await Promise.allSettled(allEndpoints.map(ep => fetchNodesFromEndpoint(ep)));

  let totalFetched = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const node of result.value) {
        const key = node.pubkey || node.publicKey;
        if (key && !nodesMap.has(key)) {
          nodesMap.set(key, node);
          totalFetched++;
        }
      }
    }
  }

  console.log(`[Sync] Fetched ${nodesMap.size} unique nodes from ${allEndpoints.length} endpoints`);
  return nodesMap;
}

// ============================================================================
// STEP 2: ENRICH WITH DETAILED STATS (CPU, RAM, PACKETS)
// ============================================================================

interface NodeStats {
  cpu_percent?: number;
  ram_used?: number;
  ram_total?: number;
  packets_received?: number;
  packets_sent?: number;
  active_streams?: number;
  uptime?: number;
}

async function fetchStatsForNode(node: PNode): Promise<NodeStats | null> {
  const ip = node.address?.split(':')[0];
  if (!ip) return null;

  const portsToTry = [node.rpcPort || 6000, 6000, 9000];

  for (const port of portsToTry) {
    const result = await callPRPC(`http://${ip}:${port}/rpc`, 'get-stats', 2000);
    if (result) return result as NodeStats;
  }

  return null;
}

export async function enrichWithStats(nodesMap: Map<string, PNode>): Promise<void> {
  const nodes = Array.from(nodesMap.values());
  const BATCH_SIZE = 20;
  let enrichedCount = 0;

  console.log(`[Sync] Enriching ${nodes.length} nodes with detailed stats...`);

  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(n => fetchStatsForNode(n)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        const stats = result.value;
        const node = batch[j];

        node.cpuPercent = stats.cpu_percent;
        node.ramUsed = stats.ram_used;
        node.ramTotal = stats.ram_total;
        node.packetsReceived = stats.packets_received;
        node.packetsSent = stats.packets_sent;
        node.activeStreams = stats.active_streams;
        if (stats.uptime) node.uptime = stats.uptime;
        if (node.status !== 'online') node.status = 'online';

        enrichedCount++;
      }
    }

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= nodes.length) {
      console.log(`[Sync] Stats progress: ${Math.min(i + BATCH_SIZE, nodes.length)}/${nodes.length}`);
    }
  }

  console.log(`[Sync] Enriched ${enrichedCount}/${nodes.length} nodes with stats`);
}

// ============================================================================
// STEP 3: ENRICH WITH LOCATION DATA
// ============================================================================

export async function enrichWithLocation(nodesMap: Map<string, PNode>): Promise<void> {
  const { batchFetchLocations } = await import('./location-cache');

  const nodesNeedingGeo = Array.from(nodesMap.values()).filter(n => {
    const ip = n.address?.split(':')[0];
    return ip && !n.locationData?.lat;
  });

  if (nodesNeedingGeo.length === 0) {
    console.log('[Sync] All nodes already have location data');
    return;
  }

  const ips = [...new Set(nodesNeedingGeo.map(n => n.address?.split(':')[0]).filter(Boolean))] as string[];
  console.log(`[Sync] Fetching location for ${ips.length} IPs...`);

  const geoMap = await batchFetchLocations(ips);

  for (const node of nodesNeedingGeo) {
    const ip = node.address?.split(':')[0];
    if (ip && geoMap.has(ip)) {
      const geo = geoMap.get(ip)!;
      node.location = geo.city ? `${geo.city}, ${geo.country}` : geo.country;
      node.locationData = {
        lat: geo.lat,
        lon: geo.lon,
        city: geo.city,
        country: geo.country,
        countryCode: geo.countryCode,
      };
    }
  }

  console.log(`[Sync] Added location data for ${geoMap.size} nodes`);
}

// ============================================================================
// STEP 4: ENRICH WITH CREDITS
// ============================================================================

export async function enrichWithCredits(nodesMap: Map<string, PNode>): Promise<void> {
  console.log('[Sync] Fetching pod credits...');

  try {
    const response = await fetch(POD_CREDITS_API, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return;

    const data = await response.json();
    if (data.status !== 'success' || !data.pods_credits) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    let count = 0;

    for (const pod of data.pods_credits) {
      const node = nodesMap.get(pod.pod_id);
      if (node) {
        node.credits = pod.credits;
        node.creditsResetMonth = currentMonth;
        count++;
      }
    }

    console.log(`[Sync] Added credits for ${count} nodes`);
  } catch (error: any) {
    console.warn(`[Sync] Failed to fetch credits: ${error.message}`);
  }
}

// ============================================================================
// STEP 5: ENRICH WITH ON-CHAIN BALANCE (new nodes only)
// ============================================================================

export async function enrichWithBalance(
  nodesMap: Map<string, PNode>,
  existingNodes: Map<string, PNode>
): Promise<void> {
  const { fetchBalanceForPubkey } = await import('./balance-cache');

  // Only fetch balance for nodes that don't have it yet
  const nodesNeedingBalance = Array.from(nodesMap.values()).filter(node => {
    const existing = existingNodes.get(node.pubkey || node.publicKey || '');
    return !existing?.balance && existing?.balance !== 0;
  });

  if (nodesNeedingBalance.length === 0) {
    console.log('[Sync] All nodes already have balance data');
    return;
  }

  console.log(`[Sync] Fetching balance for ${nodesNeedingBalance.length} new nodes...`);

  for (const node of nodesNeedingBalance) {
    const pubkey = node.pubkey || node.publicKey;
    if (!pubkey) continue;

    try {
      const balanceData = await fetchBalanceForPubkey(pubkey);
      if (balanceData) {
        node.balance = balanceData.balance;
        node.isRegistered = balanceData.balance > 0;
        if (balanceData.managerPDA) node.managerPDA = balanceData.managerPDA;
      }
    } catch {
      // Silent fail for individual balance fetches
    }
  }

  console.log(`[Sync] Balance enrichment complete`);
}

// ============================================================================
// STEP 6: DEDUPLICATE (merge same pubkey with different IPs)
// ============================================================================

export function deduplicateNodes(nodesMap: Map<string, PNode>): PNode[] {
  const byPubkey = new Map<string, PNode>();

  for (const node of nodesMap.values()) {
    const pubkey = node.pubkey || node.publicKey;
    if (!pubkey) continue;

    const existing = byPubkey.get(pubkey);
    if (!existing) {
      byPubkey.set(pubkey, node);
      continue;
    }

    // Merge: keep newer data, track previous addresses
    const merged: PNode = {
      ...existing,
      ...node,
      // Preserve identifiers
      id: existing.id || node.id,
      pubkey: existing.pubkey || node.pubkey,
      publicKey: existing.publicKey || node.publicKey,
      // Track IP changes
      previousAddresses: existing.address && existing.address !== node.address
        ? [...(existing.previousAddresses || []), existing.address]
        : existing.previousAddresses,
      // Preserve balance if not in new data
      balance: node.balance ?? existing.balance,
      managerPDA: node.managerPDA || existing.managerPDA,
      // Preserve location if not in new data
      location: node.location || existing.location,
      locationData: node.locationData || existing.locationData,
    };

    byPubkey.set(pubkey, merged);
  }

  console.log(`[Sync] Deduplicated to ${byPubkey.size} unique nodes`);
  return Array.from(byPubkey.values());
}

// ============================================================================
// STEP 7: SAVE TO DATABASE
// ============================================================================

export async function saveNodes(nodes: PNode[]): Promise<void> {
  const { upsertNodes, getAllNodes: getExistingNodes } = await import('./mongodb-nodes');

  console.log(`[Sync] Saving ${nodes.length} nodes to database...`);
  await upsertNodes(nodes);
  console.log(`[Sync] Save complete`);
}

// ============================================================================
// STEP 8: DETECT AND LOG ACTIVITY
// ============================================================================

async function detectAndLogActivity(newNode: PNode, oldNode: PNode | undefined) {
  const { storeActivityLog } = await import('./mongodb-activity');
  const { emitActivity } = await import('./socket-server');

  const pubkey = newNode.pubkey || newNode.publicKey || '';
  const nodeAddress = newNode.address || '';
  const countryCode = newNode.locationData?.countryCode || '??';
  const location = newNode.location || 'Unknown';

  // 1. New Node Detection
  if (!oldNode) {
    const log = {
      pubkey,
      address: nodeAddress,
      type: 'new_node' as const,
      message: `${nodeAddress || pubkey.slice(0, 8) + '...'} discovered (${location})`,
      countryCode,
      location,
      data: { status: newNode.status }
    };
    await storeActivityLog(log);
    emitActivity({ ...log, timestamp: new Date() });
  }

  // 2. Status Change
  if (oldNode && oldNode.status !== newNode.status) {
    let type: any = 'status_change';
    let message = `${nodeAddress || pubkey.slice(0, 8) + '...'} changed status to ${newNode.status}`;

    if (newNode.status === 'online') {
      type = 'node_online';
      message = `${nodeAddress || pubkey.slice(0, 8) + '...'} came online (${location})`;
    } else if (newNode.status === 'offline') {
      type = 'node_offline';
      message = `${nodeAddress || pubkey.slice(0, 8) + '...'} went offline`;
    } else if (newNode.status === 'syncing') {
      type = 'node_syncing';
      message = `${nodeAddress || pubkey.slice(0, 8) + '...'} is now syncing`;
    }

    const log = {
      pubkey,
      address: nodeAddress,
      type,
      message,
      countryCode,
      location,
      data: { oldStatus: oldNode.status, newStatus: newNode.status }
    };

    await storeActivityLog(log);
    emitActivity({ ...log, timestamp: new Date() });
  }

  // 3. Credits Earned
  if (oldNode && newNode.credits !== undefined && oldNode.credits !== undefined && newNode.credits > oldNode.credits) {
    const earned = newNode.credits - oldNode.credits;
    const log = {
      pubkey,
      address: nodeAddress,
      type: 'credits_earned' as const,
      message: `${nodeAddress || pubkey.slice(0, 8) + '...'} earned ${earned.toFixed(2)} credits`,
      countryCode,
      location,
      data: { earned, total: newNode.credits }
    };

    await storeActivityLog(log);
    emitActivity({ ...log, timestamp: new Date() });
  }

  // 4. Packets Earned
  const newRx = newNode.packetsReceived || 0;
  const oldRx = oldNode?.packetsReceived || 0;
  const newTx = newNode.packetsSent || 0;
  const oldTx = oldNode?.packetsSent || 0;

  if (oldNode && (newRx > oldRx || newTx > oldTx)) {
    const rxEarned = newRx - oldRx;
    const txEarned = newTx - oldTx;
    const log = {
      pubkey,
      address: nodeAddress,
      type: 'packets_earned' as const,
      message: `${nodeAddress || pubkey.slice(0, 8) + '...'} processed ${rxEarned + txEarned} packets`,
      countryCode,
      location,
      data: { rxEarned, txEarned, totalRx: newRx, totalTx: newTx }
    };

    await storeActivityLog(log);
    emitActivity({ ...log, timestamp: new Date() });
  }

  // 5. Active Streams
  if (oldNode && newNode.activeStreams !== undefined && oldNode.activeStreams !== undefined && newNode.activeStreams > oldNode.activeStreams) {
    const increased = newNode.activeStreams - oldNode.activeStreams;
    const log = {
      pubkey,
      address: nodeAddress,
      type: 'streams_active' as const,
      message: `${nodeAddress || pubkey.slice(0, 8) + '...'} active streams increased by ${increased} (Total: ${newNode.activeStreams})`,
      countryCode,
      location,
      data: { increased, total: newNode.activeStreams }
    };

    await storeActivityLog(log);
    emitActivity({ ...log, timestamp: new Date() });
  }
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

export async function syncNodes(): Promise<{ success: boolean; count: number; error?: string }> {
  const startTime = Date.now();

  try {
    // Step 1: Fetch all nodes from gossip
    const nodesMap = await fetchAllNodes();
    if (nodesMap.size === 0) {
      return { success: false, count: 0, error: 'No nodes fetched from gossip' };
    }

    // Step 2: Enrich with detailed stats (CPU, RAM, packets)
    await enrichWithStats(nodesMap);

    // Step 3: Enrich with location data
    await enrichWithLocation(nodesMap);

    // Step 4: Enrich with credits
    await enrichWithCredits(nodesMap);

    // Step 5: Get existing nodes for balance check
    const { getAllNodes: getExistingNodes } = await import('./mongodb-nodes');
    let existingNodesMap = new Map<string, PNode>();
    try {
      const existing = await getExistingNodes();
      existing.forEach(n => {
        const key = n.pubkey || n.publicKey;
        if (key) existingNodesMap.set(key, n);
      });
    } catch {
      // Continue without existing nodes
    }

    // Step 6: Enrich with balance (new nodes only)
    await enrichWithBalance(nodesMap, existingNodesMap);

    // Step 7: Deduplicate
    const dedupedNodes = deduplicateNodes(nodesMap);

    // Step 8: Detect and Log Activity
    console.log(`[Sync] Detecting activity for ${dedupedNodes.length} nodes...`);
    for (const node of dedupedNodes) {
      const pubkey = node.pubkey || node.publicKey;
      if (pubkey) {
        const oldNode = existingNodesMap.get(pubkey);
        await detectAndLogActivity(node, oldNode);
      }
    }

    // Step 9: Save to database
    await saveNodes(dedupedNodes);

    // Step 9: Merge with ALL DB nodes for complete snapshot
    // This ensures offline nodes are included in health calculations
    const { getAllNodes } = await import('./mongodb-nodes');
    const allDbNodes = await getAllNodes();

    // Create a set of pubkeys we saw in gossip this cycle
    const seenPubkeys = new Set(dedupedNodes.map(n => n.pubkey || n.publicKey));

    // Mark nodes not seen in gossip as offline, keep others as-is
    const completeNodes = allDbNodes.map(node => {
      const pubkey = node.pubkey || node.publicKey;
      if (pubkey && !seenPubkeys.has(pubkey)) {
        // Node wasn't seen in gossip - mark as offline
        return {
          ...node,
          status: 'offline' as const,
          seenInGossip: false,
        };
      }
      // Node was seen in gossip - keep its current status
      return node;
    });

    const offlineCount = completeNodes.length - seenPubkeys.size;

    // Step 10: Store historical snapshot with ALL nodes
    try {
      const { storeHistoricalSnapshot } = await import('./mongodb-history');
      console.log(`[Sync] Storing historical snapshot for ${completeNodes.length} nodes (${seenPubkeys.size} online, ${offlineCount} offline)...`);
      await storeHistoricalSnapshot(completeNodes);
      console.log('[Sync] ✅ Historical snapshot stored successfully');
    } catch (e: any) {
      console.error('[Sync] ❌ Failed to store historical snapshot:', {
        error: e?.message,
        stack: e?.stack,
        name: e?.name,
      });
      // Don't fail the entire sync if snapshot fails, but log it clearly
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync] ✅ Complete: ${dedupedNodes.length} nodes in ${Math.round(duration / 1000)}s`);

    return { success: true, count: dedupedNodes.length };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Sync] ❌ Failed after ${Math.round(duration / 1000)}s:`, error.message);
    return { success: false, count: 0, error: error.message };
  }
}
