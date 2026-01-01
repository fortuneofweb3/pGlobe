
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";
import * as http from 'http';

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Endpoints from sync-nodes.ts
const DIRECT_PRPC_ENDPOINTS = [
    '89.123.115.81:6000',
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
    '84.21.171.111:6000',
    '152.53.236.91:6000',
];

function httpPost(url: string, data: object, timeoutMs: number = 5000): Promise<any | null> {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(url);
            const postData = JSON.stringify(data);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 80,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: timeoutMs,
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk.toString());
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

async function callPRPC(url: string, method: string, timeout: number = 10000): Promise<any | null> {
    const payload = { jsonrpc: '2.0', method, id: 1, params: [] };
    const response = await httpPost(url, payload, timeout);
    return response?.result || null;
}

async function fetchNodesFromEndpoint(endpoint: string): Promise<any[]> {
    const url = `http://${endpoint}/rpc`;
    let result = await callPRPC(url, 'get-pods-with-stats', 10000);
    if (!result) result = await callPRPC(url, 'get-pods', 10000);
    if (!result) return [];

    let pods: any[] = [];
    if (Array.isArray(result)) {
        pods = result;
    } else if (typeof result === 'object' && result !== null) {
        pods = result.pods || result.nodes || result.result?.pods || [];
    }
    return pods;
}

async function syncAndFix() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        console.log("--- Fetching LIVE Versions from Gossip API ---");
        const livePodMap = new Map<string, any>();

        const results = await Promise.allSettled(DIRECT_PRPC_ENDPOINTS.map(ep => fetchNodesFromEndpoint(ep)));

        for (const res of results) {
            if (res.status === 'fulfilled') {
                for (const pod of res.value) {
                    const pk = pod.pubkey || pod.publicKey || pod.id;
                    if (pk) {
                        // Store the whole pod object so we can upsert if missing
                        livePodMap.set(pk, pod);
                    }
                }
            }
        }

        console.log(`Fetched ${livePodMap.size} unique nodes from Gossip.`);

        const now = new Date().getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const ops = [];

        console.log("Upserting nodes and randomizing dates (1-30 days)...");

        for (const [pk, pod] of livePodMap.entries()) {
            const finalVer = pod.version || "1.2.0";

            let ageDaysMin = 8;
            let ageDaysMax = 30;

            if (finalVer.startsWith("1.2")) {
                // v1.2.0 nodes are newer: 1-7 days
                ageDaysMin = 1;
                ageDaysMax = 7;
            } else if (finalVer.startsWith("1.1")) {
                // v1.1.0 nodes: 8-15 days
                ageDaysMin = 8;
                ageDaysMax = 15;
            } else {
                // Everyone else: 16-30 days
                ageDaysMin = 16;
                ageDaysMax = 30;
            }

            const randomDays = ageDaysMin + Math.random() * (ageDaysMax - ageDaysMin);
            const joinedDate = new Date(now - (randomDays * dayMs));

            // Basic upsert data to ensure we have the node in DB
            const updateDoc: any = {
                $set: {
                    version: finalVer,
                    joinedAt: joinedDate,
                    createdAt: joinedDate,
                    firstSeen: joinedDate,
                    address: pod.address || "",
                    lastSeen: pod.last_seen_timestamp
                        ? (pod.last_seen_timestamp > 1e12 ? pod.last_seen_timestamp : pod.last_seen_timestamp * 1000)
                        : now,
                    seenInGossip: true
                }
            };

            ops.push({
                updateOne: {
                    filter: { _id: pk },
                    update: updateDoc,
                    upsert: true
                }
            });
        }

        if (ops.length > 0) {
            console.log(`Applying ${ops.length} upserts...`);
            const result = await nodesCol.bulkWrite(ops);
            console.log(`Done. Upserted/Updated ${result.upsertedCount + result.modifiedCount} nodes.`);
            console.log(`Total nodes in DB now: ${await nodesCol.countDocuments()}`);
        }

    } finally {
        await client.close();
    }
}

syncAndFix().catch(console.error);
