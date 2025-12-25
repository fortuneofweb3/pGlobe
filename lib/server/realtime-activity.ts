/**
 * Real-time Activity Detector
 * 
 * Polls gossip endpoints directly every 5 seconds to detect activity changes
 * and emit Socket.io events in real-time without waiting for full sync.
 */

import http from 'http';
import https from 'https';
import { emitActivity } from './socket-server';
import { getAllNodes } from './mongodb-nodes';

// In-memory cache of previous node states
let previousNodeStates: Map<string, {
    packetsReceived: number;
    packetsSent: number;
    activeStreams: number;
    status: string;
}> = new Map();

let isPolling = false;
let pollInterval: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 5000; // 5 seconds
const STATS_TIMEOUT_MS = 2000; // 2 second timeout for stats fetch

/**
 * Fetch stats from a single node's gossip RPC
 */
async function fetchNodeStats(address: string, rpcPort?: number): Promise<any> {
    return new Promise((resolve) => {
        try {
            const [host, portStr] = address.split(':');
            const port = rpcPort || parseInt(portStr) || 9001;

            const postData = JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getStats',
                params: []
            });

            const options = {
                hostname: host,
                port: port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: STATS_TIMEOUT_MS,
            };

            const req = http.request(options, (res) => {
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
 * Check for activity changes and emit events
 */
async function checkForActivityChanges() {
    if (isPolling) return;
    isPolling = true;

    try {
        // Get list of online nodes from DB (addresses only)
        const nodes = await getAllNodes();
        const onlineNodes = nodes.filter(n => n.status === 'online' && n.address);
        const now = new Date();
        let emittedCount = 0;

        // Sample a subset of nodes each poll to avoid overload (max 20 per poll)
        const sampleSize = Math.min(20, onlineNodes.length);
        const sampledNodes = onlineNodes
            .sort(() => Math.random() - 0.5)
            .slice(0, sampleSize);

        // Fetch stats in parallel
        const statsPromises = sampledNodes.map(async (node) => {
            const pubkey = node.pubkey || node.publicKey || '';
            const address = node.address || '';
            const location = node.locationData?.city
                ? `${node.locationData.city}, ${node.locationData.country}`
                : node.locationData?.country || undefined;

            const stats = await fetchNodeStats(address, node.rpcPort);
            if (!stats) return null;

            return { node, pubkey, address, location, stats };
        });

        const results = await Promise.all(statsPromises);

        for (const result of results) {
            if (!result) continue;
            const { node, pubkey, address, location, stats } = result;

            const prev = previousNodeStates.get(pubkey);

            const currentRx = stats.packetsReceived || stats.rx_packets || 0;
            const currentTx = stats.packetsSent || stats.tx_packets || 0;
            const currentStreams = stats.activeStreams || stats.active_streams || 0;

            // First time seeing this node - store state
            if (!prev) {
                previousNodeStates.set(pubkey, {
                    packetsReceived: currentRx,
                    packetsSent: currentTx,
                    activeStreams: currentStreams,
                    status: 'online',
                });
                continue;
            }

            // Check for packet changes
            const currentPackets = currentRx + currentTx;
            const prevPackets = prev.packetsReceived + prev.packetsSent;
            const packetDiff = currentPackets - prevPackets;

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

            // Check for stream changes
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
                status: 'online',
            });
        }

        if (emittedCount > 0) {
            console.log(`[RealtimeActivity] ✅ Emitted ${emittedCount} events from ${sampleSize} nodes`);
        }
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

    console.log(`[RealtimeActivity] 🚀 Starting real-time activity poller (every ${POLL_INTERVAL_MS / 1000}s)`);

    // Initial check after 3 seconds (let server initialize)
    setTimeout(checkForActivityChanges, 3000);

    // Start periodic polling
    pollInterval = setInterval(checkForActivityChanges, POLL_INTERVAL_MS);
}

/**
 * Stop the real-time activity poller
 */
export function stopRealtimeActivityPoller() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('[RealtimeActivity] 🛑 Stopped real-time activity poller');
    }
}

/**
 * Clear cached states
 */
export function clearActivityCache() {
    previousNodeStates.clear();
    console.log('[RealtimeActivity] 🗑️  Cleared activity cache');
}
