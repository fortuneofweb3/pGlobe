/**
 * Optimized Region History Data Management
 *
 * This module provides HIGH-PERFORMANCE region-specific historical data
 * by using a PRE-AGGREGATED collection instead of expensive runtime aggregations.
 *
 * Key Design Principles:
 * 1. Pre-aggregate region data during snapshot creation (O(1) writes vs O(N) reads)
 * 2. Use in-memory caching with TTL to reduce MongoDB load
 * 3. Implement progressive loading with fallbacks for better UX
 * 4. Add proper indexes for fast queries
 *
 * Collection Structure:
 * - region_history: Pre-aggregated snapshots BY REGION, created during background refresh
 * - Each document contains metrics for ONE region at ONE timestamp
 * - Much faster to query than unwinding all node snapshots
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { getDb } from './mongodb-nodes';
import { calculateNetworkHealth } from '../utils/network-health';

const COLLECTION_NAME = 'region_history';

/**
 * Pre-aggregated regional snapshot
 * Stored once per region per 10-minute interval
 */
export interface RegionHistorySnapshot {
  _id?: ObjectId;
  timestamp: number; // Unix timestamp in milliseconds
  interval: string; // YYYY-MM-DD-HH-MM format for 10-minute aggregation
  date: string; // YYYY-MM-DD for easy querying

  // Region identification
  country: string; // Country name
  countryCode: string; // ISO 2-letter country code

  // Aggregated metrics for this region
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  syncingNodes: number;

  // Resource metrics (averaged)
  avgCpuPercent: number;
  avgRamPercent: number;

  // Network activity (summed for region)
  totalPacketsReceived: number;
  totalPacketsSent: number;
  totalActiveStreams: number;
  totalCredits: number;

  // Calculated metrics
  avgUptime: number; // Average uptime in seconds
  avgPacketRate: number; // Average packets per second

  // Geographic
  cities: number; // Number of unique cities in this region

  // Version distribution
  versionDistribution: Record<string, number>;

  // Network health score (calculated from region nodes)
  networkHealthScore: number; // Overall (40% availability + 35% version + 25% distribution)
  networkHealthAvailability: number; // % online
  networkHealthVersion: number; // % on latest version
  networkHealthDistribution: number; // Geographic diversity

  // Per-node credit tracking (for accurate credit earned calculations)
  // This allows us to calculate credits earned independent of nodes joining/leaving
  nodeCredits?: Array<{
    nodeId: string; // Node identifier (pubkey/id)
    credits: number; // Credits for this specific node
  }>;
}

// In-memory cache for region history
// Key: `${country}:${countryCode}:${startTime}:${endTime}`
interface CacheEntry {
  data: RegionHistorySnapshot[];
  timestamp: number; // When cached
  ttl: number; // Time to live in ms
}

const regionHistoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache

/**
 * Get the region history collection
 */
async function getRegionHistoryCollection(): Promise<Collection<RegionHistorySnapshot>> {
  const db = await getDb();
  return db.collection<RegionHistorySnapshot>(COLLECTION_NAME);
}

/**
 * Create indexes for fast region queries
 */
export async function createRegionHistoryIndexes(): Promise<void> {
  try {
    const collection = await getRegionHistoryCollection();

    // Compound index for region + time range queries (MOST IMPORTANT)
    await collection.createIndex(
      { country: 1, timestamp: -1 },
      { name: 'country_timestamp' }
    );

    // Compound index using country code + timestamp
    await collection.createIndex(
      { countryCode: 1, timestamp: -1 },
      { name: 'countryCode_timestamp' }
    );

    // Index on interval for deduplication during writes
    await collection.createIndex(
      { interval: 1, country: 1 },
      { unique: true, name: 'interval_country_unique' }
    );

    // Index on date for daily queries
    await collection.createIndex({ date: 1 });

    console.log('[MongoDB RegionHistory] ✅ Indexes created');
  } catch (error: any) {
    console.error('[MongoDB RegionHistory] ❌ Failed to create indexes:', error?.message || error);
    throw error;
  }
}

/**
 * Store pre-aggregated region snapshots
 * Called during background refresh after storing node history
 */
export async function storeRegionSnapshots(
  nodesByRegion: Map<string, Array<any>>,
  timestamp: number,
  interval: string,
  date: string
): Promise<void> {
  if (nodesByRegion.size === 0) {
    console.warn('[MongoDB RegionHistory] ⚠️  No regions to snapshot');
    return;
  }

  console.log(`[MongoDB RegionHistory] 📸 Creating snapshots for ${nodesByRegion.size} regions...`);

  try {
    const collection = await getRegionHistoryCollection();
    const bulkOps: any[] = [];

    // Process each region
    for (const [regionKey, nodes] of nodesByRegion.entries()) {
      if (nodes.length === 0) continue;

      // Extract country and countryCode from first node
      const firstNode = nodes[0];
      const country = firstNode.nodeLocation?.country || firstNode.location || 'Unknown';
      const countryCode = firstNode.nodeLocation?.countryCode || '';

      if (!country || country === 'Unknown') {
        console.warn('[MongoDB RegionHistory] ⚠️  Skipping region with unknown country');
        continue;
      }

      // Calculate aggregated metrics
      const onlineNodes = nodes.filter(n => n.status === 'online').length;
      const offlineNodes = nodes.filter(n => n.status === 'offline').length;
      const syncingNodes = nodes.filter(n => n.status === 'syncing').length;

      // CPU/RAM averages
      const nodesWithCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null);
      const avgCpuPercent = nodesWithCPU.length > 0
        ? nodesWithCPU.reduce((sum, n) => sum + n.cpuPercent, 0) / nodesWithCPU.length
        : 0;

      const nodesWithRAM = nodes.filter(n => n.ramPercent !== undefined && n.ramPercent !== null);
      const avgRamPercent = nodesWithRAM.length > 0
        ? nodesWithRAM.reduce((sum, n) => sum + n.ramPercent, 0) / nodesWithRAM.length
        : 0;

      // Network activity totals
      const totalPacketsReceived = nodes.reduce((sum, n) => sum + (n.packetsReceived || 0), 0);
      const totalPacketsSent = nodes.reduce((sum, n) => sum + (n.packetsSent || 0), 0);
      const totalActiveStreams = nodes.reduce((sum, n) => sum + (n.activeStreams || 0), 0);
      const totalCredits = nodes.reduce((sum, n) => sum + (n.credits || 0), 0);

      // Uptime average
      const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime > 0);
      const avgUptime = nodesWithUptime.length > 0
        ? nodesWithUptime.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodesWithUptime.length
        : 0;

      // Packet rate
      const avgPacketRate = avgUptime > 0
        ? (totalPacketsReceived + totalPacketsSent) / avgUptime
        : 0;

      // Cities count
      const cities = new Set(nodes.map(n => n.nodeLocation?.city).filter(Boolean)).size;

      // Version distribution
      const versionDistribution: Record<string, number> = {};
      nodes.forEach(n => {
        const version = n.version || 'unknown';
        versionDistribution[version] = (versionDistribution[version] || 0) + 1;
      });

      // Calculate network health score using the same formula as analytics
      // (40% availability, 35% version, 25% distribution)
      const networkHealth = calculateNetworkHealth(nodes as any);

      // Capture per-node credits for accurate credit earned calculations
      // This allows tracking true earned credits independent of nodes joining/leaving
      const nodeCredits = nodes
        .filter(n => {
          // Only include nodes with valid identifiers and credit data
          const hasId = n.pubkey || n.publicKey || n.id;
          const hasCredits = n.credits !== undefined && n.credits !== null && !isNaN(n.credits);
          return hasId && hasCredits;
        })
        .map(n => ({
          nodeId: n.pubkey || n.publicKey || n.id,
          credits: n.credits || 0,
        }));

      // Create snapshot document
      const snapshot: RegionHistorySnapshot = {
        timestamp,
        interval,
        date,
        country,
        countryCode,
        totalNodes: nodes.length,
        onlineNodes,
        offlineNodes,
        syncingNodes,
        avgCpuPercent,
        avgRamPercent,
        totalPacketsReceived,
        totalPacketsSent,
        totalActiveStreams,
        totalCredits,
        avgUptime,
        avgPacketRate,
        cities,
        versionDistribution,
        networkHealthScore: networkHealth.overall,
        networkHealthAvailability: networkHealth.availability,
        networkHealthVersion: networkHealth.versionHealth,
        networkHealthDistribution: networkHealth.distribution,
        nodeCredits, // Store per-node credits for accurate delta calculations
      };

      // Use updateOne with upsert to avoid duplicates
      bulkOps.push({
        updateOne: {
          filter: { interval, country },
          update: { $set: snapshot },
          upsert: true,
        }
      });
    }

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps, { ordered: false });
      console.log(`[MongoDB RegionHistory] ✅ Stored ${bulkOps.length} region snapshots (${result.upsertedCount} new, ${result.modifiedCount} updated)`);
    }

    // Clear cache for affected regions
    clearCacheForTimestamp(timestamp);

  } catch (error: any) {
    console.error('[MongoDB RegionHistory] ❌ Failed to store region snapshots:', {
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * Get region history with caching
 * MUCH FASTER than old aggregation approach
 */
export async function getRegionHistory(
  country: string,
  countryCode?: string,
  startTime?: number,
  endTime?: number
): Promise<RegionHistorySnapshot[]> {
  try {
    // Generate cache key
    const cacheKey = `${country}:${countryCode || ''}:${startTime || 0}:${endTime || 0}`;

    // Check cache first
    const cached = regionHistoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < cached.ttl)) {
      console.log(`[MongoDB RegionHistory] 🎯 Cache hit for ${country} (${cached.data.length} points)`);
      return cached.data;
    }

    // Cache miss - query database
    console.log('[MongoDB RegionHistory] 💾 Cache miss, querying database for:', {
      country,
      countryCode,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
    });

    const collection = await getRegionHistoryCollection();

    // Build query - try both country name and country code
    const query: any = {
      $or: [
        { country },
        ...(countryCode ? [{ countryCode }] : []),
      ],
    };

    // Add time range
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }

    console.log('[MongoDB RegionHistory] Query:', JSON.stringify(query, null, 2));

    const queryStartTime = Date.now();

    // Execute query with proper projection and timeout
    const snapshots = await collection
      .find(query)
      .sort({ timestamp: 1 }) // Oldest first
      .limit(1000) // Limit to prevent huge results
      .maxTimeMS(10000) // 10 second timeout (much shorter than before!)
      .toArray();

    const queryDuration = Date.now() - queryStartTime;

    console.log(`[MongoDB RegionHistory] ✅ Query returned ${snapshots.length} snapshots in ${queryDuration}ms`);

    // Cache the result
    regionHistoryCache.set(cacheKey, {
      data: snapshots,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
    });

    // Clean up old cache entries (keep cache size manageable)
    cleanupCache();

    return snapshots;
  } catch (error: any) {
    console.error('[MongoDB RegionHistory] ❌ Failed to get region history:', {
      error: error?.message,
      stack: error?.stack,
      country,
    });

    // Return empty array on error (fail gracefully)
    return [];
  }
}

/**
 * Helper: Get latest version from array of versions
 */
function getLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;

  // Simple sort by version string (assumes semantic versioning)
  const sorted = versions
    .filter(v => v && v !== 'unknown')
    .sort((a, b) => {
      // Compare version strings
      const aParts = a.split('.').map(p => parseInt(p) || 0);
      const bParts = b.split('.').map(p => parseInt(p) || 0);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    });

  return sorted[0] || null;
}

/**
 * Clear cache entries for a specific timestamp
 */
function clearCacheForTimestamp(timestamp: number): void {
  const keysToDelete: string[] = [];

  for (const [key, entry] of regionHistoryCache.entries()) {
    // Parse key to extract time range
    const parts = key.split(':');
    const start = parseInt(parts[2]) || 0;
    const end = parseInt(parts[3]) || Infinity;

    // If timestamp falls within this cache entry's range, invalidate it
    if (timestamp >= start && timestamp <= end) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => regionHistoryCache.delete(key));

  if (keysToDelete.length > 0) {
    console.log(`[MongoDB RegionHistory] 🗑️  Cleared ${keysToDelete.length} cache entries for new timestamp`);
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of regionHistoryCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      regionHistoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[MongoDB RegionHistory] 🧹 Cleaned ${cleaned} expired cache entries`);
  }

  // If cache is still too large, remove oldest entries
  if (regionHistoryCache.size > 100) {
    const entries = Array.from(regionHistoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - 100);
    toRemove.forEach(([key]) => regionHistoryCache.delete(key));

    console.log(`[MongoDB RegionHistory] 🧹 Removed ${toRemove.length} oldest cache entries (size limit)`);
  }
}

/**
 * Clear entire cache (useful for testing or manual refresh)
 */
export function clearAllRegionCache(): void {
  const size = regionHistoryCache.size;
  regionHistoryCache.clear();
  console.log(`[MongoDB RegionHistory] 🗑️  Cleared entire cache (${size} entries)`);
}

/**
 * Get cache stats (for monitoring)
 */
export function getRegionCacheStats(): {
  size: number;
  entries: Array<{ key: string; timestamp: number; dataPoints: number; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(regionHistoryCache.entries()).map(([key, entry]) => ({
    key,
    timestamp: entry.timestamp,
    dataPoints: entry.data.length,
    age: now - entry.timestamp,
  }));

  return {
    size: regionHistoryCache.size,
    entries,
  };
}
