#!/usr/bin/env ts-node
/**
 * Realtime Activity WebSocket Server
 * 
 * Standalone server that polls gossip endpoints every 10 seconds
 * and broadcasts activity events to connected clients.
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
const REQUEST_TIMEOUT_MS = 8000;

const PROXY_RPC_ENDPOINTS = [
    'https://rpc1.pchednode.com/rpc',
    'https://rpc2.pchednode.com/rpc',
    'https://rpc3.pchednode.com/rpc',
    'https://rpc4.pchednode.com/rpc',
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
    // Try get-pods-with-stats first, fallback to get-pods
    let payload: any = { jsonrpc: '2.0', method: 'get-pods-with-stats', id: 1, params: [] };
    let response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);

    if (!response?.result) {
        payload = { jsonrpc: '2.0', method: 'get-pods', id: 1, params: [] };
        response = await httpPost(endpoint, payload, REQUEST_TIMEOUT_MS);
    }

    if (!response?.result) return [];

    const result = response.result;
    return Array.isArray(result) ? result : result.pods || result.nodes || [];
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
        // Pick a random endpoint
        const endpoint = PROXY_RPC_ENDPOINTS[Math.floor(Math.random() * PROXY_RPC_ENDPOINTS.length)];

        // Fetch pods and credits in parallel
        const [pods, creditsMap] = await Promise.all([
            fetchPodsFromEndpoint(endpoint),
            fetchCredits()
        ]);

        if (pods.length === 0) {
            console.log('[Realtime] ⚠️  No pods returned');
            return;
        }

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

            // First time - just store state
            if (!prev) {
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
                io.emit('activity', {
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

            // Check for credit changes
            const creditDiff = currentCredits - prev.credits;
            if (creditDiff > 0) {
                io.emit('activity', {
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
            }

            // Check for stream changes
            if (currentStreams !== prev.activeStreams) {
                io.emit('activity', {
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
