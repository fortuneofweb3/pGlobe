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
let connectionPromise: Promise<MongoClient> | null = null;
let lastPingTime: number = 0;
const PING_INTERVAL = 30000; // Ping every 30 seconds

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
  // If a connection attempt is already in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Check if existing client is still valid
  if (client) {
    const now = Date.now();
    if (now - lastPingTime < PING_INTERVAL) {
      return client;
    }

    try {
      const testDb = client.db(getDbName());
      await Promise.race([
        testDb.admin().command({ ping: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 5000))
      ]);
      lastPingTime = now;
      return client;
    } catch (err) {
      const error = err as Error;
      console.log(`[MongoDB] Connection stale, reconnecting... (${error?.message || 'ping failed'})`);
      try {
        await client.close();
      } catch (closeError) { }
      client = null;
    }
  }

  // Create connection promise to prevent concurrent attempts
  connectionPromise = (async () => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const uri = getMongoUri();
        if (!uri) throw new Error('MONGODB_URI not set');

        const isVercel = !!process.env.VERCEL;
        const isLocalDev = process.env.NODE_ENV === 'development' && !isVercel;

        const newClient = new MongoClient(uri, {
          serverSelectionTimeoutMS: isVercel ? 15000 : 5000,
          connectTimeoutMS: isVercel ? 15000 : 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: isVercel ? 1 : (isLocalDev ? 3 : 10),
          minPoolSize: 0,
          retryWrites: true,
          retryReads: true,
          heartbeatFrequencyMS: 10000,
          maxIdleTimeMS: isLocalDev ? 30000 : 60000,
        });

        await newClient.connect();
        lastPingTime = Date.now();
        console.log(`[MongoDB] ✅ Connected to ${getDbName()}`);
        client = newClient;
        return newClient;
      } catch (err) {
        const error = err as Error;
        lastError = error;
        if (attempt < retries) {
          const delay = 1000 * attempt;
          console.warn(`[MongoDB] Attempt ${attempt}/${retries} failed: ${error?.message || error}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error(`[MongoDB] All ${retries} connection attempts failed.`);
        }
      }
    }
    connectionPromise = null; // Reset on failure so next call can try again
    throw lastError;
  })();

  return connectionPromise;
}

export async function getDb(): Promise<Db> {
  // Always get a fresh client to ensure connection is valid
  const c = await getClient();
  // Get fresh db reference each time to avoid stale connections
  return c.db(getDbName());
}

export async function getNodesCollection(): Promise<Collection<NodeDocument>> {
  const database = await getDb();
  return database.collection<NodeDocument>('nodes');
}

export async function getManagerStatsCollection(): Promise<Collection<{ wallet: string; purchaseCount: number; updatedAt: Date }>> {
  const database = await getDb();
  return database.collection('manager_stats');
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
  mainnetCredits?: number;
  devnetCredits?: number;
  network?: string;
  creditsResetMonth?: string;
  isRegistered?: boolean;
  managerPDA?: string;
  managerWallet?: string; // Mainnet reward wallet (discovered via tx history)
  registrarWallet?: string; // Devnet wallet that registered the node
  // STOINC & Rewards (from on-chain enrichment)
  xandStake?: number; // Staked XAND in the DAO (governance)
  daoStake?: number; // Legacy, will use xandStake instead
  nftBoost?: number; // Individual NFT boost multiplier
  nftDetails?: string; // JSON stringified array of { name, multiplier, icon }
  eraBoost?: number; // Individual Era boost multiplier
  eraLabel?: string; // Which era the node belongs to (e.g., "Deep South")
  boostFactor?: number; // Combined boost multiplier (NFTs × Era)
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

function nodeToDocument(node: Partial<PNode>): Partial<NodeDocument> {
  const doc: any = {};
  const pubkey = node.pubkey || node.publicKey;
  if (pubkey) {
    doc._id = pubkey;
    doc.pubkey = pubkey;
    doc.publicKey = pubkey;
  }

  if (node.address !== undefined) doc.address = node.address;
  if (node.previousAddresses !== undefined) doc.previousAddresses = node.previousAddresses;
  if (node.version !== undefined) doc.version = node.version;
  if (node.status !== undefined) doc.status = node.status;
  if (node.lastSeen !== undefined) doc.lastSeen = node.lastSeen;
  if (node.uptime !== undefined) doc.uptime = node.uptime;
  if (node.cpuPercent !== undefined) doc.cpuPercent = node.cpuPercent;
  if (node.ramUsed !== undefined) doc.ramUsed = node.ramUsed;
  if (node.ramTotal !== undefined) doc.ramTotal = node.ramTotal;
  if (node.packetsReceived !== undefined) doc.packetsReceived = node.packetsReceived;
  if (node.packetsSent !== undefined) doc.packetsSent = node.packetsSent;
  if (node.activeStreams !== undefined) doc.activeStreams = node.activeStreams;
  if (node.storageCapacity !== undefined) doc.storageCapacity = node.storageCapacity;
  if (node.storageUsed !== undefined) doc.storageUsed = node.storageUsed;
  if (node.totalPages !== undefined) doc.totalPages = node.totalPages;
  if (node.dataOperationsHandled !== undefined) doc.dataOperationsHandled = node.dataOperationsHandled;
  if (node.isPublic !== undefined) doc.isPublic = node.isPublic;
  if (node.rpcPort !== undefined) doc.rpcPort = node.rpcPort;
  if (node.peerCount !== undefined) doc.peerCount = node.peerCount;
  if (node.peers !== undefined) doc.peers = node.peers ? JSON.stringify(node.peers) : undefined;
  if (node.location !== undefined) doc.location = node.location;

  if (node.locationData) {
    if (node.locationData.lat !== undefined) doc.locationLat = node.locationData.lat;
    if (node.locationData.lon !== undefined) doc.locationLon = node.locationData.lon;
    if (node.locationData.city !== undefined) doc.locationCity = node.locationData.city;
    if (node.locationData.country !== undefined) doc.locationCountry = node.locationData.country;
    if (node.locationData.countryCode !== undefined) doc.locationCountryCode = node.locationData.countryCode;
  }

  if (node.balance !== undefined) doc.balance = node.balance;
  if (node.credits !== undefined) doc.credits = node.credits;
  if (node.mainnetCredits !== undefined) doc.mainnetCredits = node.mainnetCredits;
  if (node.devnetCredits !== undefined) doc.devnetCredits = node.devnetCredits;
  if (node.network !== undefined) doc.network = node.network;
  if (node.creditsResetMonth !== undefined) doc.creditsResetMonth = node.creditsResetMonth;
  if (node.isRegistered !== undefined) doc.isRegistered = node.isRegistered;
  if (node.managerPDA !== undefined) doc.managerPDA = node.managerPDA;
  if (node.managerWallet !== undefined) doc.managerWallet = node.managerWallet;
  if (node.registrarWallet !== undefined) doc.registrarWallet = node.registrarWallet;

  if (node.xandStake !== undefined) doc.xandStake = node.xandStake;
  if (node.nftBoost !== undefined) doc.nftBoost = node.nftBoost;
  if (node.nftDetails !== undefined) doc.nftDetails = node.nftDetails ? JSON.stringify(node.nftDetails) : undefined;
  if (node.eraBoost !== undefined) doc.eraBoost = node.eraBoost;
  if (node.eraLabel !== undefined) doc.eraLabel = node.eraLabel;
  if (node.boostFactor !== undefined) doc.boostFactor = node.boostFactor;
  if (node.accountCreatedAt !== undefined) doc.accountCreatedAt = node.accountCreatedAt;
  if (node.firstSeenSlot !== undefined) doc.firstSeenSlot = node.firstSeenSlot;
  if (node.seenInGossip !== undefined) doc.seenInGossip = node.seenInGossip;
  if (node.onChainError !== undefined) doc.onChainError = node.onChainError;

  return doc;
}

export function documentToNode(doc: NodeDocument): PNode {
  const status: 'online' | 'offline' | 'syncing' =
    doc.seenInGossip === false ? 'offline' : (doc.status || 'offline');

  // Parse nftDetails from JSON string
  let nftDetails: { name: string; multiplier: number; icon: string }[] | undefined;
  if (doc.nftDetails) {
    try {
      nftDetails = JSON.parse(doc.nftDetails);
    } catch {
      nftDetails = undefined;
    }
  }

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
    mainnetCredits: doc.mainnetCredits,
    devnetCredits: doc.devnetCredits,
    network: doc.network as 'mainnet' | 'devnet' | 'both' | 'unknown' | undefined,
    creditsResetMonth: doc.creditsResetMonth,
    isRegistered: doc.isRegistered,
    managerPDA: doc.managerPDA,
    managerWallet: doc.managerWallet,
    registrarWallet: doc.registrarWallet,
    // STOINC & Rewards fields
    xandStake: doc.xandStake || doc.daoStake,
    nftBoost: doc.nftBoost,
    nftDetails,
    eraBoost: doc.eraBoost,
    eraLabel: doc.eraLabel,
    boostFactor: doc.boostFactor,
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
export async function upsertNodes(nodes: PNode[], skipMarkOffline: boolean = false): Promise<void> {
  if (nodes.length === 0) return;

  try {
    await getClient(2);
    const collection = await getNodesCollection();
    const now = new Date();

    // Collect all pubkeys from incoming nodes
    const incomingPubkeys = new Set<string>();
    const operations: AnyBulkWriteOperation<NodeDocument>[] = [];

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
        'credits', 'mainnetCredits', 'devnetCredits', 'network', 'creditsResetMonth', 'seenInGossip', 'pubkey', 'publicKey', 'previousAddresses',
      ];

      for (const field of statsFields) {
        const value = (doc as unknown as Record<string, unknown>)[field];
        if (value !== undefined) {
          setFields[field] = value;
        }
      }

      // Preserved fields - only set if provided (don't overwrite with undefined)
      const preservedFields = ['balance', 'isRegistered', 'managerPDA', 'managerWallet', 'registrarWallet', 'accountCreatedAt', 'firstSeenSlot',
        'location', 'locationLat', 'locationLon', 'locationCity', 'locationCountry', 'locationCountryCode',
        'xandHoldings', 'xandStake', 'daoStake', 'vestingStake', 'nftBoost', 'nftDetails'];

      for (const field of preservedFields) {
        const value = (doc as unknown as Record<string, unknown>)[field];
        if (value !== undefined && value !== null) {
          setFields[field] = value;
        }
      }

      // Era fields - explicitly allow unsetting (null) if node is unregistered
      const eraFields = ['eraBoost', 'eraLabel', 'boostFactor'];
      for (const field of eraFields) {
        const value = (doc as unknown as Record<string, unknown>)[field];
        if (value !== undefined) {
          // If value is null and node is unregistered, we unset in DB
          if (value === null) {
            // MongoDB $unset is better but for simplicity in this upsert structure we set to null
            setFields[field] = null;
          } else {
            setFields[field] = value;
          }
        }
      }

      operations.push({
        updateOne: {
          filter: { _id: pubkey },
          update: { $set: setFields, $setOnInsert: setOnInsert },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      const result = await collection.bulkWrite(operations);
      console.log(`[MongoDB] ✅ Upserted ${result.upsertedCount} new, ${result.modifiedCount} updated`);

      // Mark nodes NOT in this sync as offline (skip if requested)
      if (!skipMarkOffline) {
        const markOfflineResult = await collection.updateMany(
          { _id: { $nin: Array.from(incomingPubkeys) } },
          { $set: { seenInGossip: false, status: 'offline', updatedAt: now } }
        );

        if (markOfflineResult.modifiedCount > 0) {
          console.log(`[MongoDB] 📍 Marked ${markOfflineResult.modifiedCount} nodes as offline`);
        }
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
export async function getAllNodes(network?: string): Promise<PNode[]> {
  const retries = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Get fresh connection each time
      await getClient();
      const collection = await getNodesCollection();

      // Build query
      const query: any = {};
      if (network && network !== 'all') {
        if (network === 'mainnet') {
          query.network = { $in: ['mainnet', 'both'] };
        } else {
          query.network = network;
        }
      }

      // Use explicit cursor to ensure we get all results
      // Set batchSize to ensure we get all documents in one batch
      const cursor = collection.find(query).sort({ updatedAt: -1 }).batchSize(1000);
      let docs = await cursor.toArray();

      // Sort in-memory to push blank nodes to the end (requested by USER)
      // Human-readable nodes (with address/location) come first
      docs.sort((a: any, b: any) => {
        const aHasData = !!(a.address || a.location || a.locationCity);
        const bHasData = !!(b.address || b.location || b.locationCity);
        if (aHasData && !bHasData) return -1;
        if (!aHasData && bHasData) return 1;
        return 0; // Maintain secondary sort from DB (updatedAt)
      });

      // Double-check we got all results - if we got exactly 101, it might be a batch limit issue
      if (docs.length === 101) {
        console.warn('[MongoDB] ⚠️  Got exactly 101 nodes - possible batch limit, checking total count...');
        const totalCount = await collection.countDocuments(query);
        if (totalCount > 101) {
          console.warn(`[MongoDB] ⚠️  Database has ${totalCount} nodes but query returned only 101 - retrying with explicit batch handling...`);
          // Retry with explicit batch handling
          const allDocs: unknown[] = [];
          const batchCursor = collection.find(query).sort({ updatedAt: -1 }).batchSize(1000);
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
 * Get nodes for a specific manager
 * Throws on connection error so callers can distinguish from "not found"
 */
export async function getNodesByManager(wallet: string, network?: string): Promise<PNode[]> {
  try {
    await getClient();
    const collection = await getNodesCollection();

    // Query by managerWallet OR registrarWallet
    const query: any = {
      $or: [
        { managerWallet: wallet },
        { registrarWallet: wallet }
      ]
    };

    if (network && network !== 'all') {
      if (network === 'mainnet') {
        query.network = { $in: ['mainnet', 'both'] };
      } else {
        query.network = network;
      }
    }

    const cursor = collection.find(query).sort({ updatedAt: -1 });

    const docs = await cursor.toArray();
    console.log(`[MongoDB] ✅ Retrieved ${docs.length} nodes for manager ${wallet}`);
    return docs.map(doc => documentToNode(doc as unknown as NodeDocument));
  } catch (err) {
    const error = err as Error;
    console.error(`[MongoDB] Error fetching nodes for manager ${wallet}:`, error.message);
    // Throw the error so the API can return 500 instead of 404
    throw new Error(`Database connection error: ${error.message}`);
  }
}

/**
 * Get nodes optimized for Manager view (projection)
 */
export async function getAllNodesForManagers(): Promise<PNode[]> {
  const retries = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await getClient();
      const collection = await getNodesCollection();

      // Project only necessary fields
      const cursor = collection.find({}, {
        projection: {
          _id: 1,
          pubkey: 1,
          publicKey: 1,
          managerWallet: 1,
          registrarWallet: 1,
          credits: 1,
          status: 1,
          version: 1,
          location: 1,
          seenInGossip: 1,
          // Enrichment Fields
          xandStake: 1,
          daoStake: 1,
          nftBoost: 1,
          eraBoost: 1,
          eraLabel: 1,
          boostFactor: 1
        }
      }).batchSize(1000);

      const docs = await cursor.toArray();
      console.log(`[MongoDB] ✅ Retrieved ${docs.length} nodes (lightweight)`);
      return docs.map(doc => documentToNode(doc as unknown as NodeDocument));
    } catch (err: unknown) {
      const error = err as Error;
      lastError = error;
      const errorMsg = error?.message || String(err);
      console.error(`[MongoDB] Error fetching lightweight nodes (attempt ${attempt}/${retries}):`, errorMsg);

      if (errorMsg.includes('Topology') || errorMsg.includes('connection')) {
        client = null;
      }

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return [];
}

/**
 * Get node by pubkey
 */
export async function getNodeByPubkey(pubkey: string): Promise<PNode | null> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    const doc = await collection.findOne({ _id: pubkey });
    return doc ? documentToNode(doc as unknown as NodeDocument) : null;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error fetching node:', error.message);
    return null;
  }
}

/**
 * Update a single node with specific fields
 */
export async function updateNode(pubkey: string, updates: Partial<PNode>): Promise<void> {
  try {
    await getClient();
    const collection = await getNodesCollection();
    const doc = nodeToDocument(updates as any);

    // Remove _id from doc to avoid update error
    delete doc._id;

    await collection.updateOne(
      { _id: pubkey },
      {
        $set: {
          ...doc,
          updatedAt: new Date()
        }
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error(`[MongoDB] Error updating node ${pubkey}:`, error.message);
    throw error;
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
    await collection.createIndex({ managerWallet: 1 });
    await collection.createIndex({ registrarWallet: 1 });
    await collection.createIndex({ updatedAt: -1 });
    console.log('[MongoDB] ✅ Created indexes');
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB] Error creating indexes:', error.message);
  }
}
