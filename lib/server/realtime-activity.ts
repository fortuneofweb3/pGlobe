/**
 * Real-time Activity Detector
 * 
 * Lightweight poller that runs every 5 seconds to detect activity changes
 * and emit Socket.io events in real-time without waiting for full sync.
 */

import { emitActivity } from './socket-server';
import { getAllNodes } from './mongodb-nodes';
import { PNode } from '../types/pnode';

// In-memory cache of previous node states
let previousNodeStates: Map<string, {
    packetsReceived: number;
    packetsSent: number;
    credits: number;
    activeStreams: number;
    status: string;
}> = new Map();

let isPolling = false;
let pollInterval: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Check for activity changes and emit events
 */
async function checkForActivityChanges() {
    if (isPolling) return; // Prevent overlapping polls
    isPolling = true;

    try {
        const nodes = await getAllNodes();
        const now = new Date();

        for (const node of nodes) {
            const pubkey = node.pubkey || node.publicKey;
            if (!pubkey) continue;

            const prev = previousNodeStates.get(pubkey);
            const address = node.address || `${pubkey.substring(0, 8)}...`;
            const location = node.locationData?.city
                ? `${node.locationData.city}, ${node.locationData.country}`
                : node.locationData?.country || undefined;

            // First time seeing this node - just store state
            if (!prev) {
                previousNodeStates.set(pubkey, {
                    packetsReceived: node.packetsReceived || 0,
                    packetsSent: node.packetsSent || 0,
                    credits: node.balance || 0,
                    activeStreams: node.activeStreams || 0,
                    status: node.status || 'unknown',
                });
                continue;
            }

            // Check for packet changes
            const currentPackets = (node.packetsReceived || 0) + (node.packetsSent || 0);
            const prevPackets = prev.packetsReceived + prev.packetsSent;
            const packetDiff = currentPackets - prevPackets;

            if (packetDiff > 100) { // Only emit if significant change
                const rxDiff = (node.packetsReceived || 0) - prev.packetsReceived;
                const txDiff = (node.packetsSent || 0) - prev.packetsSent;

                emitActivity({
                    type: 'packets_earned',
                    pubkey,
                    address,
                    location,
                    message: `${address} processed ${packetDiff.toLocaleString()} packets`,
                    data: {
                        rxEarned: rxDiff,
                        txEarned: txDiff,
                        totalRx: node.packetsReceived,
                        totalTx: node.packetsSent,
                    },
                    timestamp: now,
                });
            }

            // Check for credit changes
            const currentCredits = node.balance || 0;
            const creditDiff = currentCredits - prev.credits;

            if (creditDiff > 0.01) { // Only emit if significant change
                emitActivity({
                    type: 'credits_earned',
                    pubkey,
                    address,
                    location,
                    message: `${address} earned ${creditDiff.toFixed(2)} credits`,
                    data: {
                        earned: creditDiff,
                        total: currentCredits,
                    },
                    timestamp: now,
                });
            }

            // Check for stream changes
            const currentStreams = node.activeStreams || 0;
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
            }

            // Check for status changes
            if (node.status !== prev.status) {
                if (node.status === 'online' && prev.status !== 'online') {
                    emitActivity({
                        type: 'node_online',
                        pubkey,
                        address,
                        location,
                        message: `${address} came online${location ? ` (${location})` : ''}`,
                        timestamp: now,
                    });
                } else if (node.status === 'offline' && prev.status !== 'offline') {
                    emitActivity({
                        type: 'node_offline',
                        pubkey,
                        address,
                        location,
                        message: `${address} went offline`,
                        timestamp: now,
                    });
                } else if (node.status === 'syncing') {
                    emitActivity({
                        type: 'node_syncing',
                        pubkey,
                        address,
                        location,
                        message: `${address} is now syncing`,
                        timestamp: now,
                    });
                }
            }

            // Update stored state
            previousNodeStates.set(pubkey, {
                packetsReceived: node.packetsReceived || 0,
                packetsSent: node.packetsSent || 0,
                credits: node.balance || 0,
                activeStreams: node.activeStreams || 0,
                status: node.status || 'unknown',
            });
        }
    } catch (error: any) {
        console.error('[RealtimeActivity] ❌ Error checking for changes:', error?.message);
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

    // Initial check
    checkForActivityChanges();

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
 * Clear cached states (useful for testing)
 */
export function clearActivityCache() {
    previousNodeStates.clear();
    console.log('[RealtimeActivity] 🗑️  Cleared activity cache');
}
