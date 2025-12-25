#!/usr/bin/env ts-node
/**
 * Realtime Activity WebSocket Server
 * 
 * Standalone server that polls gossip endpoints every 10 seconds
 * and broadcasts activity events to connected clients.
 * 
 * MongoDB storage is handled by the main sync server to avoid
 * overwhelming the connection with burst writes.
 * 
 * Deploy this as a separate Render service.
 * 
 * Usage: npm run start:realtime
 */

import express from 'express';
import http from 'http';
import https from 'https';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.REALTIME_PORT || process.env.PORT || 3002;
const POLL_INTERVAL_MS = 10000; // 10 seconds
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds (match sync-nodes.ts)

const PROXY_RPC_ENDPOINTS = [
    'https://rpc1.pchednode.com/rpc',
    'https://rpc2.pchednode.com/rpc',
    'https://rpc3.pchednode.com/rpc',
    'https://rpc4.pchednode.com/rpc',
];

// Direct PRPC endpoints (same as sync-nodes.ts)
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

// ============================================================================
// TYPES
// ============================================================================

interface RawPod {
    address?: string;
    pubkey?: string;
    publicKey?: string;
    packets_received?: number;
    packets_sent?: number;
    active_streams?: number;
    credits?: number;
    balance?: number;
    city?: string;
    country?: string;
    location?: string;
}

interface PreviousState {
    packetsReceived: number;
    packetsSent: number;
    activeStreams: number;
    credits: number;
}

// ============================================================================
// STATE
// ============================================================================

const previousNodeStates = new Map<string, PreviousState>();
let isPolling = false;

// ============================================================================
// HTTP HELPERS
// ============================================================================

function httpPost(url: string, data: object, timeoutMs: number): Promise<any | null> {
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

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchPodsFromEndpoint(endpoint: string): Promise<RawPod[]> {
    try {
        // Try get-pods-with-stats first, fallback to get-pods
        let payload: any = { jsonrpc: '2.0', method: 'get-pods-with-stats', id: 1, params: [] };
        let response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);

        if (!response?.result) {
            payload = { jsonrpc: '2.0', method: 'get-pods', id: 1, params: [] };
            response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);
        }

        if (!response?.result) {
            console.log(`[Realtime] ❌ No result from ${endpoint} - response:`, JSON.stringify(response).slice(0, 200));
            return [];
        }

        const result = response.result;
        const pods = Array.isArray(result) ? result : result.pods || result.nodes || [];

        // Log stream stats for debugging
        const withStreams = pods.filter((p: RawPod) => (p.active_streams || 0) > 0).length;
        console.log(`[Realtime] ✅ ${endpoint} returned ${pods.length} pods, ${withStreams} with active streams`);

        return pods;
    } catch (error: any) {
        console.error(`[Realtime] ❌ Error fetching from ${endpoint}:`, error.message);
        return [];
    }
}

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
        // Silent fail
    }

    return creditsMap;
}

// ============================================================================
// ACTIVITY DETECTION
// ============================================================================

async function pollAndEmitActivity(io: SocketIOServer) {
    if (isPolling) return;
    isPolling = true;

    const startTime = Date.now();

    try {
        // Query ALL endpoints in parallel (same as sync-nodes.ts)
        const allEndpoints = [
            ...PROXY_RPC_ENDPOINTS,
            ...DIRECT_PRPC_ENDPOINTS.map(e => `http://${e}/rpc`)
        ];

        console.log(`[Realtime] 📊 Querying ${allEndpoints.length} endpoints...`);

        // Fetch from all endpoints in parallel
        const results = await Promise.allSettled(
            allEndpoints.map(ep => fetchPodsFromEndpoint(ep))
        );

        // Merge all pods (dedupe by pubkey)
        const podsMap = new Map<string, RawPod>();
        let successfulEndpoints = 0;

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                successfulEndpoints++;
                for (const pod of result.value) {
                    const pubkey = pod.pubkey || pod.publicKey || '';
                    if (pubkey && !podsMap.has(pubkey)) {
                        podsMap.set(pubkey, pod);
                    }
                }
            }
        }

        const pods = Array.from(podsMap.values());

        // Also fetch credits
        const creditsMap = await fetchCredits();

        if (pods.length === 0) {
            console.log(`[Realtime] ⚠️  No pods returned from ${allEndpoints.length} endpoints (${successfulEndpoints} successful)`);
            return;
        }

        console.log(`[Realtime] ✅ Got ${pods.length} pods from ${successfulEndpoints}/${allEndpoints.length} endpoints`);

        const now = new Date();
        let emittedCount = 0;
        const connectedClients = io.sockets.sockets.size;

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
            const currentCredits = creditsMap.get(pubkey) || pod.credits || pod.balance || 0;

            const prev = previousNodeStates.get(pubkey);

            // First time - emit initial state and store
            if (!prev) {
                // Emit initial stream state for racing visualization
                if (currentStreams > 0) {
                    const activityLog = {
                        type: 'streams_active' as const,
                        pubkey,
                        address,
                        location,
                        message: `${address} has ${currentStreams} active streams`,
                        data: {
                            total: currentStreams,
                            previous: 0,
                        },
                    };
                    io.emit('activity', { ...activityLog, timestamp: now });
                    emittedCount++;
                }

                previousNodeStates.set(pubkey, {
                    packetsReceived: currentRx,
                    packetsSent: currentTx,
                    activeStreams: currentStreams,
                    credits: currentCredits,
                });
                continue;
            }

            // Check for packet changes
            const packetDiff = (currentRx + currentTx) - (prev.packetsReceived + prev.packetsSent);
            if (packetDiff > 0) {
                const activityLog = {
                    type: 'packets_earned' as const,
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
                };
                io.emit('activity', { ...activityLog, timestamp: now });
                emittedCount++;
            }

            // Check for credit changes
            const creditDiff = currentCredits - prev.credits;
            if (creditDiff > 0) {
                const activityLog = {
                    type: 'credits_earned' as const,
                    pubkey,
                    address,
                    location,
                    message: `${address} earned ${creditDiff.toFixed(2)} credits`,
                    data: {
                        earned: creditDiff,
                        total: currentCredits,
                    },
                };
                io.emit('activity', { ...activityLog, timestamp: now });
                emittedCount++;
            }

            // Check for stream changes
            if (currentStreams !== prev.activeStreams) {
                const activityLog = {
                    type: 'streams_active' as const,
                    pubkey,
                    address,
                    location,
                    message: `${address} has ${currentStreams} active streams`,
                    data: {
                        total: currentStreams,
                        previous: prev.activeStreams,
                    },
                };
                io.emit('activity', { ...activityLog, timestamp: now });
                emittedCount++;
            }

            // Update state
            previousNodeStates.set(pubkey, {
                packetsReceived: currentRx,
                packetsSent: currentTx,
                activeStreams: currentStreams,
                credits: currentCredits,
            });
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Realtime] 📈 ${pods.length} pods, ${emittedCount} events → ${connectedClients} clients (${elapsed}ms)`);

    } catch (error: any) {
        console.error('[Realtime] ❌ Error:', error?.message);
    } finally {
        isPolling = false;
    }
}

// ============================================================================
// SERVER
// ============================================================================

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'realtime-activity',
        clients: io.sockets.sockets.size,
        cachedNodes: previousNodeStates.size,
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[Socket] 🔌 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[Socket] 🔌 Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`[Realtime] 🚀 Server running on port ${PORT}`);
    console.log(`[Realtime] 📡 Polling every ${POLL_INTERVAL_MS / 1000}s`);

    // Start polling after 3 seconds
    setTimeout(() => pollAndEmitActivity(io), 3000);

    // Poll every 10 seconds
    setInterval(() => pollAndEmitActivity(io), POLL_INTERVAL_MS);
});
