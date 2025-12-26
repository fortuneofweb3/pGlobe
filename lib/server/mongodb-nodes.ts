/**
 * MongoDB Node Storage
 * 
 * Simple CRUD operations for pNodes.
 * Deduplication is handled upstream in sync-nodes.ts.
 */

import { MongoClient, Db, Collection, AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { PublicKey } from '@solana/web3.js';
import { PNode } from '../types/pnode';

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

let client: MongoClient | null = null;

function getMongoUri(): string | undefined {
  return process.env.MONGODB_URI;
}

function getDbName(): string {
  const uri = getMongoUri();
  if (!uri) return process.env.MONGODB_DB_NAME || 'pGlobe';
  const uriMatch = uri.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/);
  return uriMatch?.[1] || process.env.MONGODB_DB_NAME || 'pGlobe';
}

async function getClient(retries: number = 3): Promise<MongoClient> {
  // Check if existing client is still valid
  if (client) {
    try {
      // Use a fresh db reference to avoid stale connections
      const testDb = client.db(getDbName());
      await Promise.race([
        testDb.admin().command({ ping: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
      ]);
      return client;
    } catch (err) {
      const error = err as Error;
      console.log(`[MongoDB] Connection lost, reconnecting... (${error?.message || 'ping failed'})`);
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
      client = null;
    }
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const uri = getMongoUri();
      if (!uri) throw new Error('MONGODB_URI not set');

      const isVercel = !!process.env.VERCEL;
      const isLocalDev = process.env.NODE_ENV === 'development' && !isVercel;

      // Use smaller connection pool for local dev to avoid competing with production
      // Production Render server should use more connections, local dev uses fewer
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: isVercel ? 15000 : 20000, // Longer timeout for local dev
        connectTimeoutMS: isVercel ? 15000 : 20000,
        socketTimeoutMS: 45000,
        maxPoolSize: isVercel ? 1 : (isLocalDev ? 3 : 10), // Local dev: 3, production: 10
        minPoolSize: 0,
        retryWrites: true,
        retryReads: true,
        // Add heartbeat to keep connection alive
        heartbeatFrequencyMS: 10000,
        // For local dev, be more aggressive about closing idle connections
        maxIdleTimeMS: isLocalDev ? 30000 : 60000, // Close idle connections faster in dev
      });

      await client.connect();
      await Promise.race([
        client.db(getDbName()).admin().command({ ping: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 3000))
      ]);

      console.log(`[MongoDB] ✅ Connected to ${getDbName()}`);
      return client;
    } catch (err) {
      const error = err as Error;
      lastError = error;
      if (attempt < retries) {
        const delay = 1000 * attempt;
        console.warn(`[MongoDB] Attempt ${attempt}/${retries} failed: ${error?.message || error}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`[MongoDB] All ${retries} connection attempts failed. Last error: ${error?.message || error}`);
        if (error?.message?.includes('timeout')) {
          console.error('[MongoDB] 💡 Tip: If production server is connected, it may be using connection pool. Try:');
          console.error('[MongoDB]   1. Wait a few seconds and retry');
          console.error('[MongoDB]   2. Check MongoDB Atlas connection limits');
          console.error('[MongoDB]   3. Use separate database for local dev (set MONGODB_DB_NAME)');
        }
      }
      if (client) { try { await client.close(); } catch { } }
      client = null;
    }
  }

  throw lastError;
}

export async function getDb(): Promise<Db> {
  // Always get a fresh client to ensure connection is valid
  const c = await getClient();
  // Get fresh db reference each time to avoid stale connections
  return c.db(getDbName());
}

export async function getNodesCollection(): Promise<Collection> {
  const database = await getDb();
  return database.collection('nodes');
}

// ============================================================================
// TYPES
// ============================================================================

export interface NodeDocument {
  _id: string;
  address: string;
  pubkey?: string;
  publicKey?: string;
  previousAddresses?: string[];
  version?: string;
  status?: 'online' | 'offline' | 'syncing';
  lastSeen?: number;
  uptime?: number;
  cpuPercent?: number;
  ramUsed?: number;
  ramTotal?: number;
  packetsReceived?: number;
  packetsSent?: number;
  activeStreams?: number;
  storageCapacity?: number;
  storageUsed?: number;
  totalPages?: number;
  dataOperationsHandled?: number;
  isPublic?: boolean;
  rpcPort?: number;
  peerCount?: number;
  peers?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  locationCity?: string;
  locationCountry?: string;
  locationCountryCode?: string;
  balance?: number;
  credits?: number;
  creditsResetMonth?: string;
  isRegistered?: boolean;
  managerPDA?: string;
  accountCreatedAt?: Date;
  firstSeenSlot?: number;
  seenInGossip?: boolean;
  onChainError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidPubkey(pubkey: string | null | undefined): boolean {
  if (!pubkey || typeof pubkey !== 'string') return false;
  const trimmed = pubkey.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false;

  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CONVERSIONS
// ============================================================================

function nodeToDocument(node: PNode): Partial<NodeDocument> {
  const pubkey = node.pubkey || node.publicKey || '';
  return {
    _id: pubkey,
    address: node.address || '',
    pubkey,
    publicKey: pubkey,
    previousAddresses: node.previousAddresses,
    version: node.version,
    status: node.status,
    lastSeen: node.lastSeen,
    uptime: node.uptime,
    cpuPercent: node.cpuPercent,
    ramUsed: node.ramUsed,
    ramTotal: node.ramTotal,
    packetsReceived: node.packetsReceived,
    packetsSent: node.packetsSent,
    activeStreams: node.activeStreams,
    storageCapacity: node.storageCapacity,
    storageUsed: node.storageUsed,
    totalPages: node.totalPages,
    dataOperationsHandled: node.dataOperationsHandled,
    isPublic: node.isPublic,
    rpcPort: node.rpcPort,
    peerCount: node.peerCount,
    peers: node.peers ? JSON.stringify(node.peers) : undefined,
    location: node.location,
    locationLat: node.locationData?.lat,
    locationLon: node.locationData?.lon,
    locationCity: node.locationData?.city,
    locationCountry: node.locationData?.country,
    locationCountryCode: node.locationData?.countryCode,
    balance: node.balance,
    credits: node.credits,
    creditsResetMonth: node.creditsResetMonth,
    isRegistered: node.isRegistered,
    managerPDA: node.managerPDA,
    accountCreatedAt: node.accountCreatedAt,
    firstSeenSlot: node.firstSeenSlot,
    seenInGossip: node.seenInGossip,
    onChainError: node.onChainError,
  };
}

export function documentToNode(doc: NodeDocument): PNode {
  const status: 'online' | 'offline' | 'syncing' =
    doc.seenInGossip === false ? 'offline' : (doc.status || 'offline');

  const node: PNode = {
    id: doc._id || '',
    pubkey: doc.pubkey || doc.publicKey || '',
    publicKey: doc.publicKey || doc.pubkey || '',
    address: doc.address || '',
    previousAddresses: doc.previousAddresses,
    version: doc.version || '',
    status,
    lastSeen: doc.lastSeen,
    uptime: doc.uptime,
    cpuPercent: doc.cpuPercent,
    ramUsed: doc.ramUsed,
    ramTotal: doc.ramTotal,
    packetsReceived: doc.packetsReceived,
    packetsSent: doc.packetsSent,
    activeStreams: doc.activeStreams,
    storageCapacity: doc.storageCapacity,
    storageUsed: doc.storageUsed,
    totalPages: doc.totalPages,
    dataOperationsHandled: doc.dataOperationsHandled,
    isPublic: doc.isPublic,
    rpcPort: doc.rpcPort,
    peerCount: doc.peerCount,
    peers: doc.peers ? JSON.parse(doc.peers) : undefined,
    balance: doc.balance,
    credits: doc.credits,
    creditsResetMonth: doc.creditsResetMonth,
    isRegistered: doc.isRegistered,
    managerPDA: doc.managerPDA,
    accountCreatedAt: doc.accountCreatedAt,
    firstSeenSlot: doc.firstSeenSlot,
    seenInGossip: doc.seenInGossip,
    onChainError: doc.onChainError,
    createdAt: doc.createdAt,
  };

  if (doc.locationLat && doc.locationLon) {
    node.location = doc.location;
    node.locationData = {
      lat: doc.locationLat,
      lon: doc.locationLon,
      city: doc.locationCity,
      country: doc.locationCountry,
      countryCode: doc.locationCountryCode,
    };
  }

  return node;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Upsert multiple nodes
 * Simple: pubkey is the primary key, overwrite stats, preserve balance if not provided
 */
export async function upsertNodes(nodes: PNode[]): Promise<void> {
  if (nodes.length === 0) return;

  try {
    await getClient(2);
    const collection = await getNodesCollection();
    const now = new Date();

    // Collect all pubkeys from incoming nodes
    const incomingPubkeys = new Set<string>();
    const operations: AnyBulkWriteOperation[] = [];

    for (const node of nodes) {
      const pubkey = node.pubkey || node.publicKey;
      if (!pubkey || !isValidPubkey(pubkey)) continue;

      incomingPubkeys.add(pubkey);
      const doc = nodeToDocument(node);

      // Build update: overwrite stats, preserve balance/location if not in new data
      const setFields: Record<string, unknown> = { updatedAt: now };
      const setOnInsert: Record<string, unknown> = { _id: pubkey, createdAt: now };

      // Stats fields - always overwrite (fresh from gossip)
      const statsFields = [
        'address', 'version', 'status', 'lastSeen', 'uptime',
        'cpuPercent', 'ramUsed', 'ramTotal', 'packetsReceived', 'packetsSent', 'activeStreams',
        'storageCapacity',
        'totalPages', 'dataOperationsHandled', 'isPublic', 'rpcPort', 'peerCount', 'peers',
        'credits', 'creditsResetMonth', 'seenInGossip', 'pubkey', 'publicKey', 'previousAddresses',
      ];

      for (const field of statsFields) {
        const value = (doc as unknown as Record<string, unknown>)[field];
        if (value !== undefined) {
          setFields[field] = value;
        }
      }

      // Preserved fields - only set if provided (don't overwrite with undefined)
      const preservedFields = ['balance', 'isRegistered', 'managerPDA', 'accountCreatedAt', 'firstSeenSlot',
        'location', 'locationLat', 'locationLon', 'locationCity', 'locationCountry', 'locationCountryCode'];

      for (const field of preservedFields) {
        const value = (doc as unknown as Record<string, unknown>)[field];
        if (value !== undefined && value !== null) {
          setFields[field] = value;
        }
      }

      operations.push({
        updateOne: {
          filter: { _id: pubkey as unknown as ObjectId },
          update: { $set: setFields, $setOnInsert: setOnInsert },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      const result = await collection.bulkWrite(operations);
      console.log(`[MongoDB] ✅ Upserted ${result.upsertedCount} new, ${result.modifiedCount} updated`);

      // Mark nodes NOT in this sync as offline
      const markOfflineResult = await collection.updateMany(
        { _id: { $nin: Array.from(incomingPubkeys) as unknown as ObjectId[] } },
        { $set: { seenInGossip: false, status: 'offline', updatedAt: now } }
      );

      if (markOfflineResult.modifiedCount > 0) {
        console.log(`[MongoDB] 📍 Marked ${markOfflineResult.modifiedCount} nodes as offline`);
      }
    }
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error upserting nodes:', error.message);
    if (error.message?.includes('Topology') || error.message?.includes('connection')) {
      client = null;
    }
    throw error;
  }
}

/**
 * Get all nodes
 */
export async function getAllNodes(): Promise<PNode[]> {
  const retries = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Get fresh connection each time
      await getClient();
      const collection = await getNodesCollection();

      // Use explicit cursor to ensure we get all results
      // Set batchSize to ensure we get all documents in one batch
      const cursor = collection.find({}).sort({ updatedAt: -1 }).batchSize(1000);
      const docs = await cursor.toArray();

      // Double-check we got all results - if we got exactly 101, it might be a batch limit issue
      if (docs.length === 101) {
        console.warn('[MongoDB] ⚠️  Got exactly 101 nodes - possible batch limit, checking total count...');
        const totalCount = await collection.countDocuments({});
        if (totalCount > 101) {
          console.warn(`[MongoDB] ⚠️  Database has ${totalCount} nodes but query returned only 101 - retrying with explicit batch handling...`);
          // Retry with explicit batch handling
          const allDocs: unknown[] = [];
          const batchCursor = collection.find({}).sort({ updatedAt: -1 }).batchSize(1000);
          for await (const doc of batchCursor) {
            allDocs.push(doc);
          }
          console.log(`[MongoDB] ✅ Retrieved ${allDocs.length} nodes after batch handling`);
          return allDocs.map(doc => documentToNode(doc as unknown as NodeDocument));
        }
      }

      if (docs.length === 0 && attempt < retries) {
        console.warn(`[MongoDB] Attempt ${attempt}/${retries}: Retrieved 0 nodes, retrying...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }

      console.log(`[MongoDB] ✅ Retrieved ${docs.length} nodes`);
      return docs.map(doc => documentToNode(doc as unknown as NodeDocument));
    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;
      const errorMsg = error?.message || String(err);
      console.error(`[MongoDB] Error fetching nodes (attempt ${attempt}/${retries}):`, errorMsg);

      // Reset connection on connection errors
      if (errorMsg.includes('Topology') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('session') ||
        errorMsg.includes('pool')) {
        client = null;
      }

      if (attempt < retries) {
        const delay = 1000 * attempt;
        console.warn(`[MongoDB] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // If all retries failed, return empty array
  console.error(`[MongoDB] ❌ All ${retries} attempts failed. Last error:`, (lastError as Error)?.message || lastError);
  return [];
}

/**
 * Get node by pubkey
 */
export async function getNodeByPubkey(pubkey: string): Promise<PNode | null> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    const doc = await collection.findOne({ _id: pubkey as unknown as ObjectId });
    return doc ? documentToNode(doc as unknown as NodeDocument) : null;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error fetching node:', error.message);
    return null;
  }
}

/**
 * Clean up invalid nodes
 */
export async function cleanupInvalidNodes(): Promise<number> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    const docs = await collection.find({}).toArray();

    const invalidIds = docs
      .filter(doc => !isValidPubkey(doc.pubkey || doc.publicKey))
      .map(doc => doc._id);

    if (invalidIds.length === 0) return 0;

    const result = await collection.deleteMany({ _id: { $in: invalidIds } });
    console.log(`[MongoDB] 🧹 Cleaned up ${result.deletedCount} invalid nodes`);
    return result.deletedCount || 0;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error cleaning up:', error.message);
    return 0;
  }
}

/**
 * Create indexes
 */
export async function createIndexes(): Promise<void> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    await collection.createIndex({ pubkey: 1 });
    await collection.createIndex({ address: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ updatedAt: -1 });
    console.log('[MongoDB] ✅ Created indexes');
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error creating indexes:', error.message);
  }
}
