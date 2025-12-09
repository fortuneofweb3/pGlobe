/**
 * MongoDB schema and operations for pNodes
 * All data is stored here and updated every 1 minute from gossip network
 * This includes both static data (address, version, location) and real-time metrics (status, uptime, CPU, RAM, packets, etc.)
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { PNode } from '../types/pnode';

// MongoDB connection
let client: MongoClient | null = null;
let db: Db | null = null;

// MongoDB connection string
// IMPORTANT: On Vercel, MONGODB_URI must be set in Environment Variables
const MONGODB_URI = process.env.MONGODB_URI;

// Extract database name from URI if present, otherwise use default or env var
function getDbName(): string {
  if (!MONGODB_URI) return process.env.MONGODB_DB_NAME || 'xandeum-analytics';
  // Check if database name is in the URI
  const uriMatch = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/);
  if (uriMatch && uriMatch[1]) {
    return uriMatch[1];
  }
  // Otherwise use env var or default
  return process.env.MONGODB_DB_NAME || 'xandeum-analytics';
}

const DB_NAME = getDbName();

/**
 * Get MongoDB client (singleton with reconnection and retry logic)
 */
async function getClient(retries: number = 3): Promise<MongoClient> {
  // Check if client exists and is connected (with faster timeout)
  if (client) {
    try {
      // Ping to check if connection is alive (with shorter timeout for faster failure)
      await Promise.race([
        client.db(DB_NAME).admin().command({ ping: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000)) // 2s timeout instead of 5s
      ]);
      return client;
    } catch (error) {
      // Connection is dead, reset and reconnect
      console.log('[MongoDB] Connection lost, reconnecting...');
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
      client = null;
      db = null;
    }
  }

  // Create new connection with retry logic
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!MONGODB_URI) {
        const errorMsg = 'MONGODB_URI is not defined. Please set it in Vercel Environment Variables.';
        console.error('[MongoDB] ❌', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Connection options optimized for Vercel serverless functions
      // Serverless functions are stateless, so we need different pooling strategy
      const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
      const clientOptions = {
        serverSelectionTimeoutMS: isVercel ? 10000 : 5000, // Longer timeout for Vercel (cold starts)
        connectTimeoutMS: isVercel ? 10000 : 5000,
        socketTimeoutMS: 30000, // 30 second socket timeout
        // For serverless: smaller pool, no min connections (functions are ephemeral)
        maxPoolSize: isVercel ? 1 : 10, // Single connection per function instance
        minPoolSize: 0, // No persistent connections in serverless
        maxIdleTimeMS: 0, // Don't keep idle connections in serverless
        // Important for Vercel: allow connections from any IP (serverless IPs are dynamic)
        // Make sure MongoDB Atlas Network Access allows 0.0.0.0/0 or Vercel IPs
      };
      
      client = new MongoClient(MONGODB_URI, clientOptions);
      await client.connect();
      
      // Test connection with timeout (faster for initial connection)
      await Promise.race([
        client.db(DB_NAME).admin().command({ ping: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection test timeout')), 3000)) // 3s timeout
      ]);
      
      console.log(`[MongoDB] ✅ Connected to database: ${DB_NAME}`);
      return client;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      
      // Log error with attempt number
      if (attempt < retries) {
        console.warn(`[MongoDB] Connection attempt ${attempt}/${retries} failed: ${errorMsg}`);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        console.error(`[MongoDB] ❌ Connection failed after ${retries} attempts: ${errorMsg}`);
        console.error('[MongoDB] URI (masked):', MONGODB_URI ? MONGODB_URI.replace(/:[^:@]+@/, ':****@') : 'not set');
        
        // Check for specific error types
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('querySrv')) {
          console.error('[MongoDB] 💡 DNS/Network error - check:');
          console.error('  1. MongoDB Atlas cluster is running (not paused)');
          console.error('  2. Network connectivity');
          console.error('  3. IP whitelist in MongoDB Atlas (Network Access)');
          console.error('  4. Connection string is correct');
        }
      }
      
      // Clean up failed connection
      if (client) {
        try {
          await client.close();
        } catch (e) {
          // Ignore close errors
        }
        client = null;
        db = null;
      }
    }
  }
  
  // All retries failed
  client = null;
  db = null;
  throw lastError;
}

/**
 * Get database instance
 */
async function getDb(): Promise<Db> {
  if (!db) {
    const client = await getClient();
    db = client.db(DB_NAME);
  }
  return db;
}

/**
 * Get nodes collection
 */
export async function getNodesCollection(): Promise<Collection> {
  const database = await getDb();
  return database.collection('nodes');
}

/**
 * MongoDB Node Document Schema
 * 
 * All data is stored here and updated every 1 minute from gossip network
 * This includes both static data (address, version, location) and real-time metrics (status, uptime, CPU, RAM, etc.)
 */
export interface NodeDocument {
  // Primary identifier
  _id: string | ObjectId; // pubkey or IP address
  
  // Network address
  address: string;
  ipAddress?: string;
  port?: number;
  
  // Alternative field names for compatibility
  publicKey?: string; // Same as _id (for compatibility)
  pubkey?: string; // Same as _id (for compatibility)
  
  // Basic info
  version?: string;
  
  // System metrics (updated every 1 minute from gossip)
  status?: 'online' | 'offline' | 'syncing';
  lastSeen?: number; // Last seen timestamp in milliseconds (from get-pods or get-pods-with-stats)
  uptime?: number; // Uptime in seconds (from get-pods-with-stats or get-stats)
  cpuPercent?: number;
  ramUsed?: number; // RAM used in bytes
  ramTotal?: number; // Total RAM in bytes
  packetsReceived?: number;
  packetsSent?: number;
  activeStreams?: number;
  latency?: number; // Latency in milliseconds
  
  // Storage metrics
  storageCapacity?: number; // Total storage capacity in bytes
  storageUsed?: number; // Storage used in bytes
  storageCommitted?: number; // Storage committed in bytes (from get-pods-with-stats v0.7.0+)
  storageUsagePercent?: number; // Storage usage percentage (from get-pods-with-stats v0.7.0+)
  totalPages?: number;
  dataOperationsHandled?: number;
  
  // pRPC accessibility
  isPublic?: boolean; // Whether pRPC is publicly accessible
  rpcPort?: number; // RPC port number
  
  // Peers
  peerCount?: number;
  peers?: string; // JSON string of PNodePeer[]
  
  // Location data (from IP geolocation - static)
  location?: string; // Human-readable location string
  locationLat?: number;
  locationLon?: number;
  locationCity?: string;
  locationCountry?: string;
  locationCountryCode?: string;
  
  // On-chain data (from Solana blockchain - static)
  balance?: number; // SOL balance
  isRegistered?: boolean; // Is node registered on-chain?
  managerPDA?: string; // Manager PDA address
  
  // On-chain account tracking
  accountCreatedAt?: Date; // When the Solana account was created
  firstSeenSlot?: number;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  
  // Gossip tracking - indicates if node was seen in the current/last gossip cycle
  seenInGossip?: boolean; // true if node was returned by gossip in the last cycle, false if not
  
  // Error tracking
  onChainError?: string;
}

/**
 * Validate if a pubkey is a valid Solana public key
 * Valid Solana pubkeys are base58 encoded and typically 32-44 characters
 */
export function isValidPubkey(pubkey: string | null | undefined): boolean {
  if (!pubkey || typeof pubkey !== 'string') return false;
  
  // Remove whitespace
  const trimmed = pubkey.trim();
  if (!trimmed) return false;
  
  // Invalid patterns: too short, contains spaces, looks like an IP, or common invalid patterns
  if (trimmed.length < 32) return false; // Solana pubkeys are at least 32 chars
  if (trimmed.length > 44) return false; // Solana pubkeys are max 44 chars
  if (/\s/.test(trimmed)) return false; // No whitespace
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false; // Not an IP address
  if (/^pubkey\d+$/i.test(trimmed)) return false; // Invalid pattern like "pubkey10"
  if (/^[0-9]+$/.test(trimmed)) return false; // Not just numbers
  
  // Try to validate as base58 Solana pubkey using PublicKey constructor
  try {
    const { PublicKey } = require('@solana/web3.js');
    new PublicKey(trimmed);
    return true;
  } catch {
    // If PublicKey validation fails, it's invalid
    return false;
  }
}

/**
 * Convert PNode to MongoDB document
 */
function nodeToDocument(node: PNode): NodeDocument {
  const pubkey = node.pubkey || node.publicKey || '';
  const ip = node.address?.split(':')[0];
  const port = node.address?.split(':')[1] ? parseInt(node.address.split(':')[1]) : undefined;
  
  // Use pubkey as _id if available, otherwise use IP address
  const _id = pubkey || ip || node.id || '';
  
  return {
    _id,
    address: node.address || '',
    ipAddress: ip,
    port,
    publicKey: node.publicKey || node.pubkey || undefined,
    pubkey: node.pubkey || node.publicKey || undefined,
    version: node.version || undefined,
    status: node.status || undefined,
    lastSeen: node.lastSeen !== undefined && node.lastSeen !== null ? node.lastSeen : undefined,
    uptime: node.uptime !== undefined && node.uptime !== null ? node.uptime : undefined,
    cpuPercent: node.cpuPercent !== undefined && node.cpuPercent !== null ? node.cpuPercent : undefined,
    ramUsed: node.ramUsed !== undefined && node.ramUsed !== null ? node.ramUsed : undefined,
    ramTotal: node.ramTotal !== undefined && node.ramTotal !== null ? node.ramTotal : undefined,
    packetsReceived: node.packetsReceived !== undefined && node.packetsReceived !== null ? node.packetsReceived : undefined,
    packetsSent: node.packetsSent !== undefined && node.packetsSent !== null ? node.packetsSent : undefined,
    activeStreams: node.activeStreams !== undefined && node.activeStreams !== null ? node.activeStreams : undefined,
    latency: node.latency !== undefined && node.latency !== null ? node.latency : undefined,
    storageCapacity: node.storageCapacity !== undefined && node.storageCapacity !== null ? node.storageCapacity : undefined,
    storageUsed: node.storageUsed !== undefined && node.storageUsed !== null ? node.storageUsed : undefined,
    storageCommitted: node.storageCommitted !== undefined && node.storageCommitted !== null ? node.storageCommitted : undefined,
    storageUsagePercent: node.storageUsagePercent || undefined,
    totalPages: node.totalPages || undefined,
    dataOperationsHandled: node.dataOperationsHandled || undefined,
    isPublic: node.isPublic || undefined,
    rpcPort: node.rpcPort || undefined,
    peerCount: node.peerCount || undefined,
    peers: node.peers ? JSON.stringify(node.peers) : undefined,
    location: node.location || undefined,
    locationLat: node.locationData?.lat || undefined,
    locationLon: node.locationData?.lon || undefined,
    locationCity: node.locationData?.city || undefined,
    locationCountry: node.locationData?.country || undefined,
    locationCountryCode: node.locationData?.countryCode || undefined,
    balance: node.balance !== undefined && node.balance !== null ? node.balance : undefined,
    isRegistered: node.isRegistered !== undefined ? node.isRegistered : undefined,
    managerPDA: node.managerPDA || undefined,
    accountCreatedAt: node.accountCreatedAt || undefined,
    firstSeenSlot: node.firstSeenSlot || undefined,
    onChainError: node.onChainError || undefined,
    seenInGossip: node.seenInGossip !== undefined ? node.seenInGossip : undefined,
  };
}

/**
 * Convert MongoDB document to PNode
 */
export function documentToNode(doc: NodeDocument): PNode {
  const node: PNode = {
    id: doc._id?.toString() || '',
    pubkey: doc.pubkey || doc.publicKey || '',
    publicKey: doc.publicKey || doc.pubkey || '',
    address: doc.address || '',
    version: doc.version || '',
    status: doc.status,
    lastSeen: doc.lastSeen,
    uptime: doc.uptime,
    cpuPercent: doc.cpuPercent,
    ramUsed: doc.ramUsed,
    ramTotal: doc.ramTotal,
    packetsReceived: doc.packetsReceived,
    packetsSent: doc.packetsSent,
    activeStreams: doc.activeStreams,
    latency: doc.latency,
    storageCapacity: doc.storageCapacity,
    storageUsed: doc.storageUsed,
    storageCommitted: doc.storageCommitted,
    storageUsagePercent: doc.storageUsagePercent,
    totalPages: doc.totalPages,
    dataOperationsHandled: doc.dataOperationsHandled,
    isPublic: doc.isPublic,
    rpcPort: doc.rpcPort,
    peerCount: doc.peerCount,
    peers: doc.peers ? JSON.parse(doc.peers) : undefined,
    balance: doc.balance,
    isRegistered: doc.isRegistered,
    managerPDA: doc.managerPDA,
    accountCreatedAt: doc.accountCreatedAt,
    firstSeenSlot: doc.firstSeenSlot,
    onChainError: doc.onChainError,
    seenInGossip: doc.seenInGossip,
  };

  if (doc.locationLat !== undefined && doc.locationLon !== undefined) {
    node.locationData = {
      lat: doc.locationLat,
      lon: doc.locationLon,
      city: doc.locationCity,
      country: doc.locationCountry,
      countryCode: doc.locationCountryCode,
    };
    node.location = doc.location;
  }

  return node;
}

/**
 * Upsert a node (insert or update)
 */
export async function upsertNode(node: PNode): Promise<void> {
  try {
    // Skip nodes without valid pubkeys
    const pubkey = node.pubkey || node.publicKey || '';
    if (!isValidPubkey(pubkey)) {
      console.log(`[MongoDB] Skipping node with invalid pubkey: ${pubkey || 'missing'} (address: ${node.address})`);
      return;
    }
    
    const collection = await getNodesCollection();
    // Use pubkey as primary identifier (we now require valid pubkey)
    const nodeId = pubkey || node.id || '';
    
    if (!nodeId) {
      console.warn('[MongoDB] Cannot upsert node without valid pubkey');
      return;
    }

    const doc = nodeToDocument(node);
    const now = new Date();
    
    // Remove createdAt, updatedAt, and _id from doc since we handle them separately
    const { _id: docId, createdAt, updatedAt, ...docWithoutTimestamps } = doc;
    
    await collection.updateOne(
      { _id: nodeId as any }, // Use pubkey or IP address as _id
      {
        $set: {
          ...docWithoutTimestamps,
          updatedAt: now,
        },
        $setOnInsert: { 
          _id: nodeId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[MongoDB] Error upserting node:`, error);
  }
}

/**
 * Upsert multiple nodes with IP address deduplication
 * Ensures no two nodes share the same IP address
 * Prioritizes nodes with pubkeys and latest versions
 */
export async function upsertNodes(nodes: PNode[]): Promise<void> {
  if (nodes.length === 0) return;

  try {
    // Ensure connection is alive before using it (with retry)
    await getClient(2);
    const collection = await getNodesCollection();
    const now = new Date();
    
    // STEP 1: Fetch all existing nodes to check for IP duplicates
    const existingNodes = await collection.find({}).toArray();
    const existingByPubkey = new Map<string, any>();
    const existingByIP = new Map<string, any>();
    
    for (const doc of existingNodes) {
      const pubkey = doc.pubkey || doc.publicKey || '';
      const ip = doc.address?.split(':')[0] || doc.ipAddress || '';
      const docId = doc._id?.toString() || '';
      
      if (pubkey) existingByPubkey.set(pubkey, doc);
      if (ip) existingByIP.set(ip, doc);
    }
    
    // STEP 2: Deduplicate incoming nodes by IP address
    // Priority: pubkey > latest version > more data
    const deduplicated = new Map<string, PNode>();
    const ipToNode = new Map<string, PNode>();
    
    for (const node of nodes) {
      const pubkey = node.pubkey || node.publicKey || '';
      const ip = node.address?.split(':')[0] || '';
      
      if (!pubkey && !ip) continue; // Skip nodes without identifier
      
      if (ip && ipToNode.has(ip)) {
        // Duplicate IP - keep the better node
        const existing = ipToNode.get(ip)!;
        const existingPubkey = existing.pubkey || existing.publicKey || '';
        const existingVersion = existing.version || '';
        const newNodeVersion = node.version || '';
        
        // Priority rules:
        // 1. Node with pubkey > node without pubkey
        // 2. Later version > earlier version
        // 3. More data > less data
        
        if (pubkey && !existingPubkey) {
          // New node has pubkey, existing doesn't - replace
          ipToNode.set(ip, node);
          if (existingPubkey) {
            deduplicated.delete(`pubkey:${existingPubkey}`);
          }
          deduplicated.set(`pubkey:${pubkey}`, node);
        } else if (!pubkey && existingPubkey) {
          // Existing has pubkey, new doesn't - keep existing
          continue;
        } else if (pubkey && existingPubkey && pubkey !== existingPubkey) {
          // Both have pubkeys but different - this shouldn't happen for same IP, but handle it
          // Keep the one with later version
          if (newNodeVersion > existingVersion) {
            ipToNode.set(ip, node);
            deduplicated.delete(`pubkey:${existingPubkey}`);
            deduplicated.set(`pubkey:${pubkey}`, node);
          }
        } else {
          // Both have same pubkey or both have no pubkey - keep better version/data
          const existingDataCount = Object.values(existing).filter(v => v !== undefined && v !== null).length;
          const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
          
          if (newNodeVersion > existingVersion || 
              (newNodeVersion === existingVersion && newNodeDataCount > existingDataCount)) {
            ipToNode.set(ip, node);
            if (pubkey) {
              deduplicated.set(`pubkey:${pubkey}`, node);
            } else {
              deduplicated.set(`ip:${ip}`, node);
            }
          }
        }
      } else {
        // New IP or first occurrence
        ipToNode.set(ip, node);
        if (pubkey) {
          deduplicated.set(`pubkey:${pubkey}`, node);
        } else {
          deduplicated.set(`ip:${ip}`, node);
        }
      }
    }
    
    // STEP 3: Build operations, handling IP->pubkey migrations
    const operations: any[] = [];
    const nodesToDelete: string[] = []; // Track _ids to delete (IP-based duplicates)
    const seenNodeIds = new Set<string>(); // Track which nodes are in this gossip cycle
    
    for (const node of deduplicated.values()) {
      const pubkey = node.pubkey || node.publicKey || '';
      const ip = node.address?.split(':')[0] || '';
      const nodeId = pubkey || ip || node.id || '';
      
      if (!nodeId) continue;
      
      // Mark node as seen in gossip (nodes being upserted are from current gossip cycle)
      node.seenInGossip = true;
      seenNodeIds.add(nodeId);
      
      // Check if there's an existing node in DB with this IP
      if (ip && existingByIP.has(ip)) {
        const existingDoc = existingByIP.get(ip);
        const existingId = existingDoc._id?.toString() || '';
        const existingPubkey = existingDoc.pubkey || existingDoc.publicKey || '';
        
        // If existing is stored by IP (no pubkey) and new node has pubkey, delete the IP-based one
        if (pubkey && !existingPubkey && existingId === ip) {
          nodesToDelete.push(ip);
          operations.push({
            deleteOne: {
              filter: { _id: ip },
            },
          });
        }
        // If existing has different pubkey for same IP, keep the one with latest version
        else if (pubkey && existingPubkey && pubkey !== existingPubkey) {
          const existingVersion = existingDoc.version || '';
          const newNodeVersion = node.version || '';
          if (newNodeVersion > existingVersion) {
            // Delete old pubkey-based node
            nodesToDelete.push(existingPubkey);
            operations.push({
              deleteOne: {
                filter: { _id: existingPubkey },
              },
            });
          } else {
            // Keep existing, skip this node
            continue;
          }
        }
      }
      
      const doc = nodeToDocument(node);
      const { _id, createdAt, updatedAt, ...docWithoutTimestamps } = doc;
      
      // Remove undefined values
      const docToUpdate = Object.fromEntries(
        Object.entries(docWithoutTimestamps).filter(([_, value]) => value !== undefined)
      );
      
      operations.push({
        updateOne: {
          filter: { _id: nodeId as any },
          update: {
            $set: {
              ...docToUpdate,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: nodeId,
              createdAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      const result = await collection.bulkWrite(operations);
      const newNodes = result.upsertedCount;
      const updatedNodes = result.modifiedCount;
      const matchedNodes = result.matchedCount;
      const deletedNodes = result.deletedCount || 0;
      
      if (deletedNodes > 0) {
        console.log(`[MongoDB] ✅ Wrote ${newNodes} new nodes, updated ${updatedNodes} existing nodes, deleted ${deletedNodes} IP-based duplicates (${matchedNodes} matched, ${operations.length} total)`);
      } else {
        console.log(`[MongoDB] ✅ Wrote ${newNodes} new nodes, updated ${updatedNodes} existing nodes (${matchedNodes} matched, ${operations.length} total)`);
      }
      
      // STEP 4: Final cleanup - remove any remaining IP-based duplicates
      // Find all nodes with pubkeys and delete IP-based versions of the same IP
      const cleanupOps: any[] = [];
      const pubkeyNodes = Array.from(deduplicated.values()).filter(n => n.pubkey || n.publicKey);
      
      for (const pubkeyNode of pubkeyNodes) {
        const ip = pubkeyNode.address?.split(':')[0] || '';
        const pubkey = pubkeyNode.pubkey || pubkeyNode.publicKey || '';
        
        if (ip && pubkey) {
          // Check if there's an IP-based document (stored by IP, not pubkey)
          const ipBasedDoc = await collection.findOne({
            _id: ip as any,
            $or: [
              { pubkey: { $exists: false } },
              { pubkey: null },
              { publicKey: { $exists: false } },
              { publicKey: null }
            ]
          });
          
          if (ipBasedDoc) {
            // Delete IP-based duplicate
            cleanupOps.push({
              deleteOne: {
                filter: { _id: ip },
              },
            });
          }
        }
      }
      
      if (cleanupOps.length > 0) {
        const cleanupResult = await collection.bulkWrite(cleanupOps);
        console.log(`[MongoDB] 🧹 Cleaned up ${cleanupResult.deletedCount || 0} remaining IP-based duplicate nodes`);
      }
      
      // STEP 5: Mark nodes NOT in this gossip cycle as not seen
      // All nodes that were upserted are marked as seenInGossip: true
      // Now mark all other nodes as seenInGossip: false
      if (seenNodeIds.size > 0) {
        const markNotSeenResult = await collection.updateMany(
          { _id: { $nin: Array.from(seenNodeIds) as any } },
          { $set: { seenInGossip: false, updatedAt: now } }
        );
        if (markNotSeenResult.modifiedCount > 0) {
          console.log(`[MongoDB] 📍 Marked ${markNotSeenResult.modifiedCount} nodes as not seen in current gossip cycle (offline)`);
        }
      }
    }
  } catch (error: any) {
    console.error('[MongoDB] Error upserting nodes:', error?.message || error);
    // Reset connection on error so it reconnects next time
    if (error?.message?.includes('Topology is closed') || error?.message?.includes('connection')) {
      console.log('[MongoDB] Resetting connection due to error');
      client = null;
      db = null;
    }
    throw error; // Re-throw to see errors in background refresh
  }
}

/**
 * Get all nodes (filtered to only include nodes with valid pubkeys)
 */
export async function getAllNodes(): Promise<PNode[]> {
  try {
    console.log('[MongoDB] getAllNodes: Starting...');
    console.log('[MongoDB] MONGODB_URI set:', !!MONGODB_URI);
    console.log('[MongoDB] DB_NAME:', DB_NAME);
    
    // Ensure connection is alive (with faster timeout for reads)
    const client = await getClient();
    console.log('[MongoDB] Client connected');
    
    const collection = await getNodesCollection();
    console.log('[MongoDB] Collection retrieved');
    
    // Count documents first to see if collection has data
    const count = await collection.countDocuments({});
    console.log(`[MongoDB] Collection has ${count} documents`);
    
    // Optimize query: use projection to only fetch needed fields, limit batch size, and use cursor
    // Note: We actually need all fields, but we can optimize the query execution
    const docs = await collection
      .find({})
      .sort({ updatedAt: -1 }) // Most recently updated first (helps with caching)
      .toArray();
    
    console.log(`[MongoDB] Retrieved ${docs.length} documents from collection`);
    
    // Filter out nodes without valid pubkeys
    const nodes = docs
      .map(doc => documentToNode(doc as unknown as NodeDocument))
      .filter(node => {
        const pubkey = node.pubkey || node.publicKey || '';
        return isValidPubkey(pubkey);
      });
    
    console.log(`[MongoDB] ✅ Returning ${nodes.length} nodes (after pubkey validation)`);
    return nodes;
  } catch (error: any) {
    console.error('[MongoDB] ❌ Error fetching nodes:', error?.message || error);
    console.error('[MongoDB] Error type:', error?.name);
    console.error('[MongoDB] Error code:', error?.code);
    console.error('[MongoDB] Stack:', error?.stack);
    
    // Reset connection on error so it reconnects next time
    if (error?.message?.includes('Topology is closed') || 
        error?.message?.includes('connection') ||
        error?.message?.includes('MONGODB_URI')) {
      console.log('[MongoDB] Resetting connection state...');
      client = null;
      db = null;
    }
    return [];
  }
}

/**
 * Clean up nodes with invalid pubkeys from database
 */
export async function cleanupInvalidNodes(): Promise<number> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    
    // Find all nodes
    const docs = await collection.find({}).toArray();
    
    // Find nodes with invalid pubkeys
    const invalidNodeIds: string[] = [];
    for (const doc of docs) {
      const pubkey = doc.pubkey || doc.publicKey || '';
      if (!isValidPubkey(pubkey)) {
        invalidNodeIds.push(doc._id.toString());
      }
    }
    
    if (invalidNodeIds.length === 0) {
      return 0;
    }
    
    // Delete invalid nodes
    const result = await collection.deleteMany({
      _id: { $in: invalidNodeIds as any }
    });
    
    console.log(`[MongoDB] 🧹 Cleaned up ${result.deletedCount} nodes with invalid pubkeys`);
    return result.deletedCount || 0;
  } catch (error: any) {
    console.error('[MongoDB] Error cleaning up invalid nodes:', error?.message || error);
    return 0;
  }
}

/**
 * Get node by pubkey
 */
export async function getNodeByPubkey(pubkey: string): Promise<PNode | null> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    const doc = await collection.findOne({ _id: pubkey as any }) || 
                await collection.findOne({ pubkey }) ||
                await collection.findOne({ publicKey: pubkey });
    if (!doc) return null;
    return documentToNode(doc as unknown as NodeDocument);
  } catch (error: any) {
    console.error('[MongoDB] Error fetching node by pubkey:', error?.message || error);
    return null;
  }
}

/**
 * Create indexes for better query performance
 */
export async function createIndexes(): Promise<void> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    
    // Create indexes
    await collection.createIndex({ pubkey: 1 });
    await collection.createIndex({ publicKey: 1 });
    await collection.createIndex({ ipAddress: 1 });
    await collection.createIndex({ address: 1 });
    await collection.createIndex({ version: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ isRegistered: 1 });
    await collection.createIndex({ updatedAt: -1 });
    
    console.log('[MongoDB] ✅ Created indexes');
  } catch (error: any) {
    console.error('[MongoDB] Error creating indexes:', error?.message || error);
  }
}
