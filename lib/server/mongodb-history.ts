/**
 * MongoDB Historical Data Storage
 * Stores 10-minute interval snapshots of VARIABLE node metrics for trend analysis
 * Each snapshot includes network-level aggregates AND per-node snapshots with status, CPU, RAM, packets, etc.
 * 
 * NOTE: This stores only VARIABLE metrics (status, CPU, RAM, packets, etc.) for each node
 * Static data like creation dates (accountCreatedAt) are stored in the main nodes collection,
 * not in snapshots, since they don't change over time.
 * 
 * Creation dates can be fetched from Solana on-chain data (see solana-enrich.ts)
 * and are stored in NodeDocument.accountCreatedAt in the main nodes collection.
 */

import { Collection, ObjectId } from 'mongodb';
import { PNode } from '../types/pnode';
import { getDb } from './mongodb-nodes';
import { calculateNetworkHealth, getLatestVersion } from '../utils/network-health';
import { storeRegionSnapshots } from './mongodb-region-history';

const COLLECTION_NAME = 'node_history';

export interface HistoricalSnapshot {
  _id?: ObjectId;
  timestamp: number; // Unix timestamp in milliseconds
  interval: string; // YYYY-MM-DD-HH-MM format for 10-minute aggregation (MM is 00, 10, 20, 30, 40, 50)
  date: string; // YYYY-MM-DD for easy querying

  // Network-level metrics (aggregated from variable node metrics)
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  syncingNodes: number;
  // Variable metrics (change frequently)
  avgCpuPercent: number; // Average CPU usage %
  avgRamPercent: number; // Average RAM usage %
  avgPacketsReceived: number; // Average cumulative packets received
  avgPacketsSent: number; // Average cumulative packets sent
  avgActiveStreams: number; // Average active network streams
  // Cumulative metrics (track behavior over time)
  avgUptime: number; // Average uptime in seconds (cumulative, but tracks if nodes stay online)
  avgUptimePercent: number; // Average uptime percentage

  // Version distribution
  versionDistribution: Record<string, number>; // version -> count

  // Geographic distribution
  countries: number;
  cities: number;

  // Network health score (calculated during snapshot creation using calculateNetworkHealth)
  networkHealthScore: number; // Overall network health score (0-100)
  networkHealthAvailability: number; // Availability component (0-100)
  networkHealthVersion: number; // Version health component (0-100)
  networkHealthDistribution: number; // Distribution component (0-100)

  // Per-node snapshots (VARIABLE metrics only - these change over time)
  // Note: Uptime is cumulative (increases), but tracking it shows behavior over time
  // (e.g., if uptime stops increasing, node went offline)
  nodeSnapshots: Array<{
    pubkey: string;
    // Variable status metrics
    status: 'online' | 'offline' | 'syncing';
    cpuPercent?: number; // % - changes frequently
    ramPercent?: number; // % - changes frequently
    packetsReceived?: number; // cumulative total - changes frequently
    packetsSent?: number; // cumulative total - changes frequently
    activeStreams?: number; // changes frequently
    // Cumulative metrics (track to see behavior over time)
    uptime?: number; // seconds - cumulative, but tracks if node stays online
    uptimePercent?: number; // calculated from uptime
    storageCapacity?: number; // bytes - total capacity allocated
    storageUsed?: number; // bytes - actual storage used - changes over time
    credits?: number; // cumulative credits earned - changes over time
    // Static-ish metadata (for context)
    version?: string; // changes occasionally
    isRegistered?: boolean; // changes occasionally
    isPublic?: boolean; // pRPC publicly accessible - changes occasionally
    location?: string; // usually static
    nodeLocation?: { lat?: number; lon?: number; country?: string; city?: string; countryCode?: string }; // geographic location
  }>;
}

/**
 * Get the historical data collection
 */
async function getHistoryCollection(): Promise<Collection<HistoricalSnapshot>> {
  const db = await getDb();
  return db.collection<HistoricalSnapshot>(COLLECTION_NAME);
}

/**
 * Create indexes for efficient querying
 */
export async function createHistoryIndexes(): Promise<void> {
  try {
    const collection = await getHistoryCollection();

    // Index on timestamp for time-range queries
    await collection.createIndex({ timestamp: -1 });

    // Index on interval for 10-minute interval aggregation queries
    await collection.createIndex({ interval: 1 });

    // Index on nodeSnapshots.pubkey for efficient node-specific queries
    await collection.createIndex({ 'nodeSnapshots.pubkey': 1 });

    // Index on date for daily queries
    await collection.createIndex({ date: 1 });

    // Compound index for node-specific queries
    await collection.createIndex({ 'nodeSnapshots.pubkey': 1, timestamp: -1 });

    // Index for region queries (by country in nodeLocation)
    await collection.createIndex({ 'nodeSnapshots.nodeLocation.country': 1, timestamp: -1 });
    await collection.createIndex({ 'nodeSnapshots.nodeLocation.countryCode': 1, timestamp: -1 });

    // TTL index: automatically delete snapshots older than 90 days
    // Note: TTL indexes require the field to be a Date, but we're using number (timestamp)
    // So we'll handle cleanup manually or convert timestamp to Date if needed
    // For now, we'll rely on manual cleanup or a separate cleanup job

    console.log('[MongoDB History] ✅ Indexes created');
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB History] ❌ Failed to create indexes:', error?.message || error);
    throw error;
  }
}

/**
 * Store a historical snapshot
 * Stores one snapshot per 10-minute interval (aggregates multiple refreshes within the same 10-minute window)
 * @param nodes - Array of nodes to snapshot
 */
export async function storeHistoricalSnapshot(
  nodes: PNode[]
): Promise<void> {
  if (!nodes || nodes.length === 0) {
    console.warn('[MongoDB History] ⚠️ No nodes provided for snapshot');
    return;
  }

  console.log(`[MongoDB History] 📸 Creating snapshot for ${nodes.length} nodes...`);

  try {
    const collection = await getHistoryCollection();
    const now = Date.now();
    const date = new Date(now);

    // Create 10-minute interval identifier (YYYY-MM-DD-HH-MM where MM is rounded to nearest 10)
    const minutes = Math.floor(date.getUTCMinutes() / 10) * 10; // Round down to nearest 10 (0, 10, 20, 30, 40, 50)
    const interval = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}-${String(minutes).padStart(2, '0')}`;
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    // Calculate network health score (40% availability, 35% version, 25% distribution)
    const networkHealth = calculateNetworkHealth(nodes);
    console.log(`[MongoDB History] 🏥 Calculated health - Overall: ${networkHealth.overall}, Availability: ${networkHealth.availability}, Version: ${networkHealth.versionHealth}, Distribution: ${networkHealth.distribution}`);

    // Check if we already have a snapshot for this 10-minute interval
    const existing = await collection.findOne({ interval });
    if (existing) {
      // Update existing snapshot (use latest data for the interval)
      const updateData: Partial<HistoricalSnapshot> = {
        timestamp: now,
        totalNodes: nodes.length,
        onlineNodes: nodes.filter(n => n.status === 'online').length,
        offlineNodes: nodes.filter(n => n.status === 'offline').length,
        syncingNodes: nodes.filter(n => n.status === 'syncing').length,
        avgCpuPercent: calculateAvgCpuPercent(nodes),
        avgRamPercent: calculateAvgRamPercent(nodes),
        avgPacketsReceived: calculateAvgPacketsReceived(nodes),
        avgPacketsSent: calculateAvgPacketsSent(nodes),
        avgActiveStreams: calculateAvgActiveStreams(nodes),
        avgUptime: calculateAvgUptime(nodes),
        avgUptimePercent: calculateAvgUptimePercent(nodes),
        versionDistribution: calculateVersionDistribution(nodes),
        countries: new Set(nodes.map(n => n.locationData?.country).filter(Boolean)).size,
        cities: new Set(nodes.map(n => n.locationData?.city).filter(Boolean)).size,
        networkHealthScore: networkHealth.overall,
        networkHealthAvailability: networkHealth.availability,
        networkHealthVersion: networkHealth.versionHealth,
        networkHealthDistribution: networkHealth.distribution,
        nodeSnapshots: createNodeSnapshots(nodes),
      };

      await collection.updateOne(
        { interval },
        { $set: updateData }
      );
      const snapshotSize = updateData.nodeSnapshots?.length || 0;
      console.log(`[MongoDB History] ✅ Updated snapshot for interval ${interval} with ${snapshotSize} node snapshots`);
      console.log(`[MongoDB History] 🏥 Health scores - Overall: ${updateData.networkHealthScore}, Availability: ${updateData.networkHealthAvailability}, Version: ${updateData.networkHealthVersion}, Distribution: ${updateData.networkHealthDistribution}`);
      return;
    }

    // Create new snapshot
    const snapshot: HistoricalSnapshot = {
      timestamp: now,
      interval,
      date: dateStr,
      totalNodes: nodes.length,
      onlineNodes: nodes.filter(n => n.status === 'online').length,
      offlineNodes: nodes.filter(n => n.status === 'offline').length,
      syncingNodes: nodes.filter(n => n.status === 'syncing').length,
      avgCpuPercent: calculateAvgCpuPercent(nodes),
      avgRamPercent: calculateAvgRamPercent(nodes),
      avgPacketsReceived: calculateAvgPacketsReceived(nodes),
      avgPacketsSent: calculateAvgPacketsSent(nodes),
      avgActiveStreams: calculateAvgActiveStreams(nodes),
      avgUptime: calculateAvgUptime(nodes),
      avgUptimePercent: calculateAvgUptimePercent(nodes),
      versionDistribution: calculateVersionDistribution(nodes),
      countries: new Set(nodes.map(n => n.locationData?.country).filter(Boolean)).size,
      cities: new Set(nodes.map(n => n.locationData?.city).filter(Boolean)).size,
      networkHealthScore: networkHealth.overall,
      networkHealthAvailability: networkHealth.availability,
      networkHealthVersion: networkHealth.versionHealth,
      networkHealthDistribution: networkHealth.distribution,
      nodeSnapshots: createNodeSnapshots(nodes),
    };

    await collection.insertOne(snapshot);
    console.log(`[MongoDB History] ✅ Stored snapshot for interval ${interval} (${nodes.length} nodes, ${snapshot.nodeSnapshots.length} node snapshots)`);
    console.log(`[MongoDB History] 🏥 Health scores - Overall: ${snapshot.networkHealthScore}, Availability: ${snapshot.networkHealthAvailability}, Version: ${snapshot.networkHealthVersion}, Distribution: ${snapshot.networkHealthDistribution}`);

    // ✨ NEW: Store pre-aggregated region snapshots for faster queries
    try {
      const nodesByRegion = groupNodesByRegion(snapshot.nodeSnapshots);
      await storeRegionSnapshots(nodesByRegion, now, interval, dateStr);
    } catch (err) {
      const regionError = err as Error;
      console.error('[MongoDB History] ⚠️  Failed to store region snapshots:', regionError?.message);
      // Don't fail the entire snapshot if region storage fails
    }
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB History] ❌ Failed to store snapshot:', {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    // Re-throw so sync-nodes can log it properly, but don't fail the entire sync
    // The sync will continue even if snapshot fails
    throw error;
  }
}

/**
 * Get historical snapshots for a time range
 */
export async function getHistoricalSnapshots(
  startTime?: number,
  endTime?: number,
  limit: number = 1000
): Promise<HistoricalSnapshot[]> {
  try {
    const collection = await getHistoryCollection();
    const query: import('mongodb').Filter<HistoricalSnapshot> = {};

    if (startTime || endTime) {
      (query as { timestamp?: { $gte?: number; $lte?: number } }).timestamp = {};
      if (startTime) (query as { timestamp: { $gte?: number } }).timestamp.$gte = startTime;
      if (endTime) (query as { timestamp: { $lte?: number } }).timestamp.$lte = endTime;
    }

    console.log(`[MongoDB History] Querying snapshots:`, {
      hasStartTime: !!startTime,
      hasEndTime: !!endTime,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      limit,
      query: JSON.stringify(query),
    });

    const queryStartTime = Date.now();

    // Add timeout to MongoDB query (15 seconds)
    const queryPromise = collection
      .find(query, {
        projection: {
          timestamp: 1,
          interval: 1,
          totalNodes: 1,
          onlineNodes: 1,
          offlineNodes: 1,
          syncingNodes: 1,
          countries: 1,
          cities: 1,
          versionDistribution: 1, // Need this for version health calculation
        }
      })
      .sort({ timestamp: 1 }) // Oldest first
      .limit(limit)
      .maxTimeMS(15000) // 15 second timeout
      .toArray();

    const timeoutPromise = new Promise<HistoricalSnapshot[]>((_, reject) => {
      setTimeout(() => {
        reject(new Error('MongoDB query timeout after 15 seconds'));
      }, 15000);
    });

    const snapshots = await Promise.race([queryPromise, timeoutPromise]);
    const queryDuration = Date.now() - queryStartTime;

    console.log(`[MongoDB History] Query returned ${snapshots.length} snapshots in ${queryDuration}ms`);

    if (snapshots.length > 0) {
      console.log(`[MongoDB History] Sample snapshot fields:`, {
        timestamp: snapshots[0].timestamp,
        interval: snapshots[0].interval,
        totalNodes: snapshots[0].totalNodes,
      });
    }

    return snapshots;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB History] ❌ Failed to get snapshots:', {
      error: error?.message || error,
      stack: error?.stack,
      name: error?.name,
      isTimeout: error?.message?.includes('timeout'),
    });
    return [];
  }
}

/**
 * Get aggregated historical data for a region (country)
 * 
 * IMPORTANT: This function AGGREGATES from EXISTING historical snapshots stored in the database.
 * It does NOT create new snapshots - it reads and aggregates from snapshots that were already
 * created by storeHistoricalSnapshot() during background refresh cycles.
 * 
 * The aggregation:
 * 1. Finds all historical snapshots within the time range
 * 2. Filters nodes by country/countryCode
 * 3. Groups nodes by their original snapshot timestamp (preserving historical timestamps)
 * 4. Aggregates metrics (online count, packets, credits, CPU, RAM) for each timestamp
 * 
 * This ensures we're showing true historical data, not creating new data points.
 */
export async function getRegionHistory(
  country: string,
  countryCode?: string,
  startTime?: number,
  endTime?: number
): Promise<Array<{
  timestamp: number;
  onlineCount: number;
  totalNodes: number;
  totalPacketsReceived: number;
  totalPacketsSent: number;
  totalCredits: number;
  avgCPU: number;
  avgRAM: number;
  versionDistribution?: Record<string, number>;
  cities?: number;
}>> {
  try {
    const collection = await getHistoryCollection();

    // Build time range query
    const timeQuery: import('mongodb').Filter<HistoricalSnapshot> = {};
    if (startTime || endTime) {
      timeQuery.timestamp = {};
      if (startTime) timeQuery.timestamp.$gte = startTime;
      if (endTime) timeQuery.timestamp.$lte = endTime;
    }

    console.log('[MongoDB History] Querying region history:', {
      country,
      countryCode,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
    });

    // Use aggregation pipeline to filter by country and aggregate
    // IMPORTANT: This aggregates from EXISTING historical snapshots, not creating new ones
    const pipeline: Record<string, unknown>[] = [
      // Match snapshots within time range
      {
        $match: {
          ...timeQuery,
        }
      },
      // Unwind nodeSnapshots to work with individual nodes
      // The parent document's timestamp is preserved automatically
      {
        $unwind: {
          path: '$nodeSnapshots',
          preserveNullAndEmptyArrays: false
        }
      },
      // Filter nodes by country (try both country name and countryCode)
      // This ensures we only aggregate nodes from the specified region
      {
        $match: {
          $or: [
            { 'nodeSnapshots.nodeLocation.country': country },
            { 'nodeSnapshots.nodeLocation.countryCode': countryCode || country },
          ]
        }
      },
      // Group by the original snapshot timestamp to aggregate all nodes from that region at that time
      // This preserves the historical snapshot timestamps - we're NOT creating new timestamps
      {
        $group: {
          _id: '$timestamp', // Use the original snapshot timestamp (preserved from parent document)
          timestamp: { $first: '$timestamp' }, // Preserve the original snapshot timestamp
          nodes: { $push: '$nodeSnapshots' }, // Collect all nodes from this region at this timestamp
        }
      },
      // Calculate aggregated metrics
      {
        $project: {
          timestamp: 1,
          onlineCount: {
            $size: {
              $filter: {
                input: '$nodes',
                as: 'node',
                cond: { $eq: ['$$node.status', 'online'] }
              }
            }
          },
          totalNodes: { $size: '$nodes' },
          totalPacketsReceived: {
            $sum: {
              $map: {
                input: '$nodes',
                as: 'node',
                in: { $ifNull: ['$$node.packetsReceived', 0] }
              }
            }
          },
          totalPacketsSent: {
            $sum: {
              $map: {
                input: '$nodes',
                as: 'node',
                in: { $ifNull: ['$$node.packetsSent', 0] }
              }
            }
          },
          // Credits: sum all credits (they're cumulative per node, so total is sum of all nodes)
          totalCredits: {
            $sum: {
              $map: {
                input: '$nodes',
                as: 'node',
                in: { $ifNull: ['$$node.credits', 0] }
              }
            }
          },
          avgCPU: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: '$nodes',
                    as: 'node',
                    cond: { $ne: ['$$node.cpuPercent', null] }
                  }
                },
                as: 'node',
                in: '$$node.cpuPercent'
              }
            }
          },
          avgRAM: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: '$nodes',
                    as: 'node',
                    cond: { $ne: ['$$node.ramPercent', null] }
                  }
                },
                as: 'node',
                in: '$$node.ramPercent'
              }
            }
          },
          // Store nodes array for later processing (we'll calculate version distribution in JavaScript)
          nodes: 1,
        }
      },
      // Sort by timestamp
      { $sort: { timestamp: 1 } },
      // Limit to prevent huge results
      { $limit: 1000 }
    ];

    const results = await collection.aggregate(pipeline, { maxTimeMS: 40000 }).toArray();

    console.log(`[MongoDB History] Aggregation results: ${results.length} snapshots found for ${country}`);
    if (results.length > 0) {
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      console.log(`[MongoDB History] Time range: ${new Date(firstResult.timestamp).toISOString()} to ${new Date(lastResult.timestamp).toISOString()}`);
      console.log(`[MongoDB History] Sample snapshot: ${firstResult.totalNodes} nodes, ${firstResult.onlineCount} online`);
    }

    // Map to expected format and calculate health from node snapshots
    // IMPORTANT: These timestamps are from HISTORICAL snapshots, not newly created
    // Removed inline require of getLatestVersion

    const aggregatedData = results.map((result) => {
      const res = result as unknown as HistoricalSnapshot;
      const nodes = res.nodeSnapshots || [];

      // Calculate version distribution from nodes
      const versionDistribution: Record<string, number> = {};
      const cities = new Set<string>();

      nodes.forEach((node) => {
        const n = node as unknown as PNode;
        const version = n.version || 'unknown';
        versionDistribution[version] = (versionDistribution[version] || 0) + 1;

        if (n.locationData?.city) {
          cities.add(n.locationData.city);
        }
      });

      // Calculate region-specific health score
      // For regions, we focus on availability and version health since geographic
      // distribution doesn't make sense when already scoped to a single country

      // 1. Availability (50% weight) - most important for region health
      const resTyped = result as unknown as HistoricalSnapshot;
      const availability = resTyped.totalNodes > 0
        ? (resTyped.onlineNodes / resTyped.totalNodes) * 100
        : 0;

      // 2. Version Health (50% weight) - are nodes on latest version?
      let versionHealth = 0;
      if (Object.keys(versionDistribution).length > 0 && result.totalNodes > 0) {
        const versions = Object.keys(versionDistribution);
        const latestVersion = getLatestVersion(versions);
        if (latestVersion) {
          const latestVersionCount = versionDistribution[latestVersion] || 0;
          versionHealth = (latestVersionCount / result.totalNodes) * 100;
        }
      }

      // Overall score: 50% availability + 50% version health
      // No distribution penalty since we're already in a single region
      const overall = Math.round(
        availability * 0.50 +
        versionHealth * 0.50
      );

      console.log(`[MongoDB History] Region health calculation for ${country}:`, {
        timestamp: result.timestamp,
        totalNodes: result.totalNodes,
        onlineCount: result.onlineNodes,
        availability: Math.round(availability),
        versionHealth: Math.round(versionHealth),
        overall,
        versionDistributionKeys: Object.keys(versionDistribution),
        citiesCount: cities.size,
      });

      return {
        timestamp: result.timestamp, // This is the original snapshot timestamp
        onlineCount: result.onlineNodes || 0,
        totalNodes: result.totalNodes || 0,
        totalPacketsReceived: result.totalPacketsReceived || 0,
        totalPacketsSent: result.totalPacketsSent || 0,
        totalCredits: result.totalCredits || 0,
        avgCPU: result.avgCPU ? Math.round(result.avgCPU * 10) / 10 : 0,
        avgRAM: result.avgRAM ? Math.round(result.avgRAM * 10) / 10 : 0,
        versionDistribution: versionDistribution,
        cities: cities.size,
      };
    });

    console.log(`[MongoDB History] ✅ Region history: ${aggregatedData.length} aggregated data points for ${country} (from historical snapshots)`);

    return aggregatedData;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB History] ❌ Failed to get region history:', {
      error: error?.message,
      stack: error?.stack,
      country,
    });
    return [];
  }
}

/**
 * Get historical data for a specific node
 */
export async function getNodeHistory(
  pubkey: string,
  startTime?: number,
  endTime?: number
): Promise<Array<HistoricalSnapshot['nodeSnapshots'][0] & {
  timestamp: number;
  serverRegionId?: string;
  serverLocation?: { lat?: number; lon?: number; country?: string; city?: string };
}>> {
  try {
    const collection = await getHistoryCollection();

    // Build time range query
    const timeQuery: import('mongodb').Filter<HistoricalSnapshot> = {};
    if (startTime || endTime) {
      timeQuery.timestamp = {};
      if (startTime) timeQuery.timestamp.$gte = startTime;
      if (endTime) timeQuery.timestamp.$lte = endTime;
    }

    console.log('[MongoDB History] Querying node history:', {
      pubkey,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
    });

    // Use aggregation pipeline for better performance
    // Filter by node FIRST to use index, then extract only that node's data
    const pipeline: import('mongodb').Document[] = [
      // Match snapshots that contain this node AND are within time range
      // This uses the compound index { 'nodeSnapshots.pubkey': 1, timestamp: -1 } efficiently
      {
        $match: {
          'nodeSnapshots.pubkey': pubkey, // Uses index - matches documents containing this node
          ...timeQuery, // Time range filter
        }
      },
      // Filter the nodeSnapshots array to only include our node
      // This avoids unwinding all nodes
      {
        $addFields: {
          nodeSnapshots: {
            $filter: {
              input: '$nodeSnapshots',
              as: 'node',
              cond: { $eq: ['$$node.pubkey', pubkey] }
            }
          }
        }
      },
      // Now unwind - but there should only be 1 element per document now
      { $unwind: '$nodeSnapshots' },
      // Project only the fields we need
      {
        $project: {
          timestamp: 1,
          serverRegionId: 1,
          serverLocation: 1,
          pubkey: '$nodeSnapshots.pubkey',
          status: '$nodeSnapshots.status',
          // latency: removed - client-side measurement
          // latencyByRegion: removed - client-side measurement
          cpuPercent: '$nodeSnapshots.cpuPercent',
          ramPercent: '$nodeSnapshots.ramPercent',
          packetsReceived: '$nodeSnapshots.packetsReceived',
          packetsSent: '$nodeSnapshots.packetsSent',
          activeStreams: '$nodeSnapshots.activeStreams',
          uptime: '$nodeSnapshots.uptime',
          uptimePercent: '$nodeSnapshots.uptimePercent',
          storageCapacity: '$nodeSnapshots.storageCapacity',
          credits: '$nodeSnapshots.credits',
          version: '$nodeSnapshots.version',
          isRegistered: '$nodeSnapshots.isRegistered',
          isPublic: '$nodeSnapshots.isPublic',
          location: '$nodeSnapshots.location',
          nodeLocation: '$nodeSnapshots.nodeLocation',
        }
      },
      // Sort by timestamp
      { $sort: { timestamp: 1 } },
      // Limit to prevent huge results (7 days = ~1000 data points max at 10-min intervals)
      { $limit: 1000 }
    ];

    // Try aggregation first (faster for large datasets)
    // Add maxTimeMS to prevent queries from running too long
    let results: unknown[];
    try {
      results = await collection.aggregate(pipeline, { maxTimeMS: 40000 }).toArray();
    } catch (aggError: unknown) {
      const error = aggError as Error;
      console.warn('[MongoDB History] Aggregation failed, falling back to find query:', error?.message);
      // Fallback to simpler query if aggregation fails
      const simpleQuery: Record<string, unknown> = {
        'nodeSnapshots.pubkey': pubkey,
        ...timeQuery,
      };
      const snapshots = await collection
        .find(simpleQuery)
        .sort({ timestamp: 1 })
        .limit(1000)
        .maxTimeMS(40000)
        .toArray();

      // Extract node-specific data points
      results = [];
      for (const snapshot of snapshots) {
        const snap = snapshot as unknown as HistoricalSnapshot;
        // Check if nodeSnapshots exists before accessing find
        if (snap.nodeSnapshots) {
          const nodeSnapshot = snap.nodeSnapshots.find((n) => n.pubkey === pubkey);
          if (nodeSnapshot) {
            results.push({
              timestamp: snapshot.timestamp,
              ...nodeSnapshot,
            });
          }
        }
      }
    }

    // Map results to expected format
    const nodeHistory = results.map((result) => {
      const res = result as Record<string, unknown>;
      return {
        timestamp: res.timestamp as number,
        pubkey: res.pubkey as string,
        status: res.status as 'online' | 'offline' | 'syncing',
        cpuPercent: res.cpuPercent as number | undefined,
        ramPercent: res.ramPercent as number | undefined,
        packetsReceived: res.packetsReceived as number | undefined,
        packetsSent: res.packetsSent as number | undefined,
        activeStreams: res.activeStreams as number | undefined,
        uptime: res.uptime as number | undefined,
        uptimePercent: res.uptimePercent as number | undefined,
        storageCapacity: res.storageCapacity as number | undefined,
        credits: res.credits as number | undefined,
        version: res.version as string | undefined,
        isRegistered: res.isRegistered as boolean | undefined,
        isPublic: res.isPublic as boolean | undefined,
        location: res.location as string | undefined,
        locationData: res.locationData as { lat?: number; lon?: number; country?: string; city?: string; countryCode?: string } | undefined,
      };
    });

    console.log(`[MongoDB History] ✅ Node history: ${nodeHistory.length} data points for ${pubkey.substring(0, 8)}...`);

    return nodeHistory;
  } catch (err) {
    const error = err as Error;
    console.error('[MongoDB History] ❌ Failed to get node history:', error?.message || error);
    return [];
  }
}

// Helper functions for calculating averages

function calculateAvgCpuPercent(nodes: PNode[]): number {
  const nodesWithCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null && n.cpuPercent >= 0);
  if (nodesWithCPU.length === 0) return 0;
  return nodesWithCPU.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / nodesWithCPU.length;
}

function calculateAvgRamPercent(nodes: PNode[]): number {
  const nodesWithRam = nodes.filter(n =>
    n.ramUsed !== undefined && n.ramUsed !== null &&
    n.ramTotal !== undefined && n.ramTotal !== null &&
    n.ramTotal > 0
  );
  if (nodesWithRam.length === 0) return 0;

  const total = nodesWithRam.reduce((sum, n) => {
    const percent = ((n.ramUsed || 0) / (n.ramTotal || 1)) * 100;
    return sum + percent;
  }, 0);

  return total / nodesWithRam.length;
}

function calculateAvgUptime(nodes: PNode[]): number {
  const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime !== null && n.uptime > 0);
  if (nodesWithUptime.length === 0) return 0;
  return nodesWithUptime.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodesWithUptime.length;
}

function calculateAvgUptimePercent(nodes: PNode[]): number {
  const nodesWithUptimePercent = nodes.filter(n => n.uptimePercent !== undefined && n.uptimePercent !== null);
  if (nodesWithUptimePercent.length === 0) return 0;
  return nodesWithUptimePercent.reduce((sum, n) => sum + (n.uptimePercent || 0), 0) / nodesWithUptimePercent.length;
}

function calculateAvgPacketsReceived(nodes: PNode[]): number {
  const nodesWithPackets = nodes.filter(n => n.packetsReceived !== undefined && n.packetsReceived !== null && n.packetsReceived >= 0);
  if (nodesWithPackets.length === 0) return 0;
  return nodesWithPackets.reduce((sum, n) => sum + (n.packetsReceived || 0), 0) / nodesWithPackets.length;
}

function calculateAvgPacketsSent(nodes: PNode[]): number {
  const nodesWithPackets = nodes.filter(n => n.packetsSent !== undefined && n.packetsSent !== null && n.packetsSent >= 0);
  if (nodesWithPackets.length === 0) return 0;
  return nodesWithPackets.reduce((sum, n) => sum + (n.packetsSent || 0), 0) / nodesWithPackets.length;
}

function calculateAvgActiveStreams(nodes: PNode[]): number {
  const nodesWithStreams = nodes.filter(n => n.activeStreams !== undefined && n.activeStreams !== null && n.activeStreams >= 0);
  if (nodesWithStreams.length === 0) return 0;
  return nodesWithStreams.reduce((sum, n) => sum + (n.activeStreams || 0), 0) / nodesWithStreams.length;
}

function calculateVersionDistribution(nodes: PNode[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const node of nodes) {
    if (node.version) {
      distribution[node.version] = (distribution[node.version] || 0) + 1;
    }
  }
  return distribution;
}

/**
 * Group node snapshots by region for pre-aggregation
 */
function groupNodesByRegion(nodeSnapshots: HistoricalSnapshot['nodeSnapshots']): Map<string, HistoricalSnapshot['nodeSnapshots']> {
  const byRegion = new Map<string, HistoricalSnapshot['nodeSnapshots']>();

  for (const snapshot of nodeSnapshots) {
    // Get country from node location
    const country = snapshot.nodeLocation?.country;

    if (!country || country === 'Unknown') {
      continue; // Skip nodes without location
    }

    // Use country name as key
    const regionKey = country;

    if (!byRegion.has(regionKey)) {
      byRegion.set(regionKey, []);
    }

    byRegion.get(regionKey)!.push(snapshot);
  }

  return byRegion;
}

function createNodeSnapshots(nodes: PNode[]): HistoricalSnapshot['nodeSnapshots'] {
  const snapshots = nodes.map(node => {
    const pubkey = node.pubkey || node.publicKey || node.id || '';
    const ramPercent = node.ramUsed && node.ramTotal && node.ramTotal > 0
      ? ((node.ramUsed / node.ramTotal) * 100)
      : undefined;

    // Determine status: use node.status if available, otherwise infer from seenInGossip
    let status: 'online' | 'offline' | 'syncing' = 'offline';
    if (node.status) {
      status = node.status as 'online' | 'offline' | 'syncing';
    } else if (node.seenInGossip === false) {
      status = 'offline';
    } else if (node.lastSeen) {
      const lastSeenTime = typeof node.lastSeen === 'string' ? new Date(node.lastSeen).getTime() : node.lastSeen;
      const timeSinceLastSeen = Date.now() - lastSeenTime;
      if (timeSinceLastSeen < 5 * 60 * 1000) { // < 5 minutes
        status = 'online';
      } else if (timeSinceLastSeen < 60 * 60 * 1000) { // < 1 hour
        status = 'syncing';
      } else {
        status = 'offline';
      }
    }

    return {
      pubkey,
      // Variable status metrics (change frequently) - these are the key metrics we track
      status,
      cpuPercent: node.cpuPercent,
      ramPercent,
      packetsReceived: node.packetsReceived,
      packetsSent: node.packetsSent,
      activeStreams: node.activeStreams,
      // Cumulative metrics (track to see behavior over time)
      uptime: node.uptime,
      uptimePercent: node.uptimePercent,
      storageCapacity: node.storageCapacity,
      storageUsed: node.storageUsed,
      credits: node.credits,
      // Static-ish metadata (for context)
      version: node.version,
      isRegistered: node.isRegistered,
      isPublic: node.isPublic,
      location: node.location,
      nodeLocation: node.locationData ? {
        lat: node.locationData.lat,
        lon: node.locationData.lon,
        country: node.locationData.country,
        city: node.locationData.city,
        countryCode: node.locationData.countryCode,
      } : undefined,
    };
  });

  return snapshots;
}
