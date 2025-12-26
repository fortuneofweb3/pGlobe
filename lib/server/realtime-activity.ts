/**
 * Real-time Activity Detector
 * 
 * Uses the same gossip endpoints as sync-nodes.ts to fetch node stats every 10 seconds.
 * Compares with previous state and emits Socket.io events for changes.
 */

import http from 'http';
import https from 'https';
import { emitActivity } from './socket-server';

// Same endpoints as sync-nodes.ts
const PROXY_RPC_ENDPOINTS = [
    'https://rpc1.pchednode.com/rpc',
    'https://rpc2.pchednode.com/rpc',
    'https://rpc3.pchednode.com/rpc',
    'https://rpc4.pchednode.com/rpc',
];

const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';

// In-memory cache of previous node states
const previousNodeStates: Map<string, {
    packetsReceived: number;
    packetsSent: number;
    activeStreams: number;
    credits: number;
    status: string;
}> = new Map();

let isPolling = false;
let pollInterval: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 10000; // 10 seconds
const REQUEST_TIMEOUT_MS = 8000; // 8 second timeout

interface RawPod {
    address?: string;
    pubkey?: string;
    publicKey?: string;
    version?: string;
    last_seen_timestamp?: number;
    packets_received?: number;
    packets_sent?: number;
    active_streams?: number;
    credits?: number;
    balance?: number;
    location?: string;
    city?: string;
    country?: string;
}

/**
 * HTTP POST request helper
 */
function httpPost(url: string, data: object, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(url);
            const postData = JSON.stringify(data);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

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

            const req = httpModule.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk: Buffer) => responseData += chunk.toString());
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

/**
 * Fetch pods from a gossip endpoint
 */
async function fetchPodsFromEndpoint(endpoint: string): Promise<RawPod[]> {
    // Try get-pods-with-stats first (v0.7.0+), fallback to get-pods
    let payload = { jsonrpc: '2.0', method: 'get-pods-with-stats', id: 1, params: [] };
    let response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);

    if (!response?.result) {
        // Fallback to get-pods
        payload = { jsonrpc: '2.0', method: 'get-pods', id: 1, params: [] };
        response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);
    }

    if (!response?.result) return [];

    let pods: RawPod[] = [];
    const result = response.result;

    if (Array.isArray(result)) {
        pods = result as unknown as RawPod[];
    } else if (typeof result === 'object' && result !== null) {
        const resObj = result as { pods?: RawPod[]; nodes?: RawPod[] };
        pods = resObj.pods || resObj.nodes || [];
    }

    return pods;
}

/**
 * Fetch credits from the pod credits API
 */
async function fetchCredits(): Promise<Map<string, number>> {
    const creditsMap = new Map<string, number>();

    try {
        const response = await fetch(POD_CREDITS_API, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (!response.ok) return creditsMap;

        const data = await response.json();
        if (data.status !== 'success' || !data.pods_credits) return creditsMap;

        for (const pod of data.pods_credits) {
            if (pod.pod_id && typeof pod.credits === 'number') {
                creditsMap.set(pod.pod_id, pod.credits);
            }
        }
    } catch {
        // Silent fail - credits are optional
    }

    return creditsMap;
}

/**
 * Check for activity changes by querying gossip
 */
async function checkForActivityChanges() {
    if (isPolling) return;

    // Skip if sync is running to avoid competing for endpoints
    const { isSyncActive } = await import('./sync-state');
    if (isSyncActive()) {
        console.log('[RealtimeActivity] ⏸️  Skipping - sync in progress');
        return;
    }

    isPolling = true;

    const startTime = Date.now();

    try {
        // Pick a random endpoint for load balancing
        const endpoint = PROXY_RPC_ENDPOINTS[Math.floor(Math.random() * PROXY_RPC_ENDPOINTS.length)];

        console.log(`[RealtimeActivity] 📊 Fetching pods and credits...`);

        // Fetch pods and credits in parallel
        const [pods, creditsMap] = await Promise.all([
            fetchPodsFromEndpoint(endpoint),
            fetchCredits()
        ]);

        if (pods.length === 0) {
            console.log(`[RealtimeActivity] ⚠️  No pods returned from endpoint`);
            isPolling = false;
            return;
        }

        const now = new Date();
        let emittedCount = 0;

        for (const pod of pods) {
            const pubkey = pod.pubkey || pod.publicKey || '';
            if (!pubkey || pubkey.length < 32) continue;

            const address = pod.address || `${pubkey.substring(0, 8)}...`;
            const location = pod.city && pod.country
                ? `${pod.city}, ${pod.country}`
                : pod.country || pod.location || undefined;

            const currentRx = pod.packets_received || 0;
            const currentTx = pod.packets_sent || 0;
            const currentStreams = pod.active_streams || 0;
            // Get credits from credits API (more accurate than pod data)
            const currentCredits = creditsMap.get(pubkey) || pod.credits || pod.balance || 0;

            const prev = previousNodeStates.get(pubkey);

            // First time - just store state
            if (!prev) {
                previousNodeStates.set(pubkey, {
                    packetsReceived: currentRx,
                    packetsSent: currentTx,
                    activeStreams: currentStreams,
                    credits: currentCredits,
                    status: 'online',
                });
                continue;
            }

            // Check for packet changes (received and sent separately)
            const rxDiff = currentRx - prev.packetsReceived;
            const txDiff = currentTx - prev.packetsSent;
            if (rxDiff > 0 || txDiff > 0) {
                const parts: string[] = [];
                if (rxDiff > 0) parts.push(`received ${rxDiff.toLocaleString()}`);
                if (txDiff > 0) parts.push(`sent ${txDiff.toLocaleString()}`);

                emitActivity({
                    type: 'packets_earned',
                    pubkey,
                    address,
                    location,
                    message: `${address} ${parts.join(' / ')} packets`,
                    data: {
                        rxEarned: rxDiff > 0 ? rxDiff : 0,
                        txEarned: txDiff > 0 ? txDiff : 0,
                        totalRx: currentRx,
                        totalTx: currentTx,
                    },
                    timestamp: now,
                });
                emittedCount++;
            }

            // Check for credit changes (earned and lost)
            const creditDiff = currentCredits - prev.credits;
            if (creditDiff > 0) {
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
                emittedCount++;
            } else if (creditDiff < 0) {
                // Track credits lost (negative change)
                const creditsLost = Math.abs(creditDiff);
                emitActivity({
                    type: 'credits_lost',
                    pubkey,
                    address,
                    location,
                    message: `${address} lost ${creditsLost.toFixed(2)} credits`,
                    data: {
                        lost: creditsLost,
                        total: currentCredits,
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
                credits: currentCredits,
                status: 'online',
            });
        }

        const elapsed = Date.now() - startTime;
        console.log(`[RealtimeActivity] 📈 Stats: ${pods.length} pods, ${emittedCount} events in ${elapsed}ms`);

    } catch (err) {
        const error = err as Error;
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

    console.log(`[RealtimeActivity] 🚀 Starting real-time poller (every ${POLL_INTERVAL_MS / 1000}s, using gossip endpoints)`);

    // First check after 5 seconds
    setTimeout(checkForActivityChanges, 5000);

    // Start periodic polling
    pollInterval = setInterval(checkForActivityChanges, POLL_INTERVAL_MS);
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
