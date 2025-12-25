/**
 * Real-time Activity Detector
 * 
 * Lightweight stats-only sync that runs every 10 seconds.
 * Fetches getStats from ALL online nodes in parallel batches.
 * Emits Socket.io events for activity changes.
 */

import http from 'http';
import { emitActivity } from './socket-server';
import { getAllNodes } from './mongodb-nodes';

// In-memory cache of previous node states
const previousNodeStates: Map<string, {
    packetsReceived: number;
    packetsSent: number;
    activeStreams: number;
}> = new Map();

let isPolling = false;
let pollInterval: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 10000; // 10 seconds
const STATS_TIMEOUT_MS = 3000; // 3 second timeout per node
const BATCH_SIZE = 50; // Process 50 nodes in parallel at a time

/**
 * Fetch stats from a single node's gossip RPC
 */
function fetchNodeStats(address: string): Promise<any> {
    return new Promise((resolve) => {
        try {
            const [host, portStr] = address.split(':');
            const port = parseInt(portStr) || 9001;

            const postData = JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getStats',
                params: []
            });

            const req = http.request({
                hostname: host,
                port: port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: STATS_TIMEOUT_MS,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk.toString());
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed?.result || null);
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

/**
 * Process a batch of nodes and emit activity events
 */
async function processBatch(nodes: any[], now: Date): Promise<{ emitted: number; success: number; failed: number }> {
    let emittedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const statsPromises = nodes.map(async (node) => {
        const pubkey = node.pubkey || node.publicKey || '';
        const address = node.address || '';
        if (!address) return null;

        const stats = await fetchNodeStats(address);
        if (!stats) {
            failedCount++;
            return null;
        }
        successCount++;

        const location = node.locationData?.city
            ? `${node.locationData.city}, ${node.locationData.country}`
            : node.locationData?.country || undefined;

        return { pubkey, address, location, stats };
    });

    const results = await Promise.all(statsPromises);

    for (const result of results) {
        if (!result) continue;
        const { pubkey, address, location, stats } = result;

        const currentRx = stats.packetsReceived || stats.rx_packets || 0;
        const currentTx = stats.packetsSent || stats.tx_packets || 0;
        const currentStreams = stats.activeStreams || stats.active_streams || 0;

        const prev = previousNodeStates.get(pubkey);

        // First time - just store
        if (!prev) {
            previousNodeStates.set(pubkey, {
                packetsReceived: currentRx,
                packetsSent: currentTx,
                activeStreams: currentStreams,
            });
            continue;
        }

        // Check packet changes
        const packetDiff = (currentRx + currentTx) - (prev.packetsReceived + prev.packetsSent);
        if (packetDiff > 0) {
            emitActivity({
                type: 'packets_earned',
                pubkey,
                address,
                location,
                message: `${address} processed ${packetDiff.toLocaleString()} packets`,
                data: {
                    rxEarned: currentRx - prev.packetsReceived,
                    txEarned: currentTx - prev.packetsSent,
                    totalRx: currentRx,
                    totalTx: currentTx,
                },
                timestamp: now,
            });
            emittedCount++;
        }

        // Check stream changes
        if (currentStreams !== prev.activeStreams) {
            emitActivity({
                type: 'streams_active',
                pubkey,
                address,
                location,
                message: `${address} has ${currentStreams} active streams`,
                data: {
                    total: currentStreams,
                    previous: prev.activeStreams,
                },
                timestamp: now,
            });
            emittedCount++;
        }

        // Update state
        previousNodeStates.set(pubkey, {
            packetsReceived: currentRx,
            packetsSent: currentTx,
            activeStreams: currentStreams,
        });
    }

    return { emitted: emittedCount, success: successCount, failed: failedCount };
}

/**
 * Check ALL nodes for activity changes
 */
async function checkAllNodesForActivity() {
    if (isPolling) return;
    isPolling = true;

    const startTime = Date.now();

    try {
        // Get all online nodes
        const nodes = await getAllNodes();
        const onlineNodes = nodes.filter(n => n.status === 'online' && n.address);
        const now = new Date();

        console.log(`[RealtimeActivity] 📊 Checking ${onlineNodes.length} online nodes...`);

        let totalEmitted = 0;
        let totalSuccess = 0;
        let totalFailed = 0;

        // Process in batches to avoid overwhelming network
        for (let i = 0; i < onlineNodes.length; i += BATCH_SIZE) {
            const batch = onlineNodes.slice(i, i + BATCH_SIZE);
            const result = await processBatch(batch, now);
            totalEmitted += result.emitted;
            totalSuccess += result.success;
            totalFailed += result.failed;
        }

        const elapsed = Date.now() - startTime;
        console.log(`[RealtimeActivity] 📈 Stats: ${totalSuccess} success, ${totalFailed} failed, ${totalEmitted} events in ${elapsed}ms`);
    } catch (error: any) {
        console.error('[RealtimeActivity] ❌ Error:', error?.message);
    } finally {
        isPolling = false;
    }
}

/**
 * Start the real-time activity poller
 */
export function startRealtimeActivityPoller() {
    if (pollInterval) {
        console.log('[RealtimeActivity] ⚠️  Poller already running');
        return;
    }

    console.log(`[RealtimeActivity] 🚀 Starting real-time stats sync (every ${POLL_INTERVAL_MS / 1000}s, batch size ${BATCH_SIZE})`);

    // First check after 5 seconds (let server initialize)
    setTimeout(checkAllNodesForActivity, 5000);

    // Start periodic polling
    pollInterval = setInterval(checkAllNodesForActivity, POLL_INTERVAL_MS);
}

/**
 * Stop the poller
 */
export function stopRealtimeActivityPoller() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('[RealtimeActivity] 🛑 Stopped');
    }
}

/**
 * Clear cached states
 */
export function clearActivityCache() {
    previousNodeStates.clear();
    console.log('[RealtimeActivity] 🗑️  Cleared cache');
}
