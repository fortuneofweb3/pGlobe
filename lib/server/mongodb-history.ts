/**
 * MongoDB Historical Data Storage
 * Stores 10-minute interval snapshots of VARIABLE node metrics for trend analysis
 * Each snapshot includes network-level aggregates AND per-node snapshots with status, latency, CPU, RAM, packets, etc.
 * 
 * NOTE: This stores only VARIABLE metrics (status, latency, CPU, RAM, packets, etc.) for each node
 * Static data like creation dates (accountCreatedAt) are stored in the main nodes collection,
 * not in snapshots, since they don't change over time.
 * 
 * Creation dates can be fetched from Solana on-chain data (see solana-enrich.ts)
 * and are stored in NodeDocument.accountCreatedAt in the main nodes collection.
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { PNode } from '../types/pnode';
import { getDb } from './mongodb-nodes';

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
  avgLatency: number; // Average latency in ms
  avgCpuPercent: number; // Average CPU usage %
  avgRamPercent: number; // Average RAM usage %
  avgPacketsReceived: number; // Average packets received per second
  avgPacketsSent: number; // Average packets sent per second
  avgActiveStreams: number; // Average active network streams
  // Cumulative metrics (track behavior over time)
  avgUptime: number; // Average uptime in seconds (cumulative, but tracks if nodes stay online)
  avgUptimePercent: number; // Average uptime percentage
  
  // Version distribution
  versionDistribution: Record<string, number>; // version -> count
  
  // Geographic distribution
  countries: number;
  cities: number;
  
  // Per-node snapshots (VARIABLE metrics only - these change over time)
  // Note: Uptime is cumulative (increases), but tracking it shows behavior over time
  // (e.g., if uptime stops increasing, node went offline)
  nodeSnapshots: Array<{
    pubkey: string;
    // Variable status metrics
    status: 'online' | 'offline' | 'syncing';
    latency?: number; // ms - changes frequently
    cpuPercent?: number; // % - changes frequently
    ramPercent?: number; // % - changes frequently
    packetsReceived?: number; // per second - changes frequently
    packetsSent?: number; // per second - changes frequently
    activeStreams?: number; // changes frequently
    // Cumulative metrics (track to see behavior over time)
    uptime?: number; // seconds - cumulative, but tracks if node stays online
    uptimePercent?: number; // calculated from uptime
    storageUsed?: number; // bytes - can grow over time
    storageCapacity?: number; // bytes - usually static but can change
    // Static-ish metadata (for context)
    version?: string; // changes occasionally
    isRegistered?: boolean; // changes occasionally
    location?: string; // usually static
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
    
    // TTL index: automatically delete snapshots older than 90 days
    // Note: TTL indexes require the field to be a Date, but we're using number (timestamp)
    // So we'll handle cleanup manually or convert timestamp to Date if needed
    // For now, we'll rely on manual cleanup or a separate cleanup job
    
    console.log('[MongoDB History] ✅ Indexes created');
  } catch (error: any) {
    console.error('[MongoDB History] ❌ Failed to create indexes:', error?.message || error);
    throw error;
  }
}

/**
 * Store a historical snapshot
 * Stores one snapshot per 10-minute interval (aggregates multiple refreshes within the same 10-minute window)
 */
export async function storeHistoricalSnapshot(nodes: PNode[]): Promise<void> {
  try {
    const collection = await getHistoryCollection();
    const now = Date.now();
    const date = new Date(now);
    
    // Create 10-minute interval identifier (YYYY-MM-DD-HH-MM where MM is rounded to nearest 10)
    const minutes = Math.floor(date.getUTCMinutes() / 10) * 10; // Round down to nearest 10 (0, 10, 20, 30, 40, 50)
    const interval = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}-${String(minutes).padStart(2, '0')}`;
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    
    // Check if we already have a snapshot for this 10-minute interval
    const existing = await collection.findOne({ interval });
    if (existing) {
      // Update existing snapshot (use latest data for the interval)
      await collection.updateOne(
        { interval },
        {
          $set: {
            timestamp: now,
            totalNodes: nodes.length,
            onlineNodes: nodes.filter(n => n.status === 'online').length,
            offlineNodes: nodes.filter(n => n.status === 'offline').length,
            syncingNodes: nodes.filter(n => n.status === 'syncing').length,
            avgLatency: calculateAvgLatency(nodes),
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
            nodeSnapshots: createNodeSnapshots(nodes),
          },
        }
      );
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
      avgLatency: calculateAvgLatency(nodes),
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
      nodeSnapshots: createNodeSnapshots(nodes),
    };
    
    await collection.insertOne(snapshot);
    console.log(`[MongoDB History] ✅ Stored snapshot for ${interval} (${nodes.length} nodes, ${snapshot.nodeSnapshots.length} node snapshots)`);
  } catch (error: any) {
    console.error('[MongoDB History] ❌ Failed to store snapshot:', error?.message || error);
    // Don't throw - historical data is nice to have but not critical
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
    const query: any = {};
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }
    
    const snapshots = await collection
      .find(query)
      .sort({ timestamp: 1 }) // Oldest first
      .limit(limit)
      .toArray();
    
    return snapshots;
  } catch (error: any) {
    console.error('[MongoDB History] ❌ Failed to get snapshots:', error?.message || error);
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
): Promise<Array<HistoricalSnapshot['nodeSnapshots'][0] & { timestamp: number }>> {
  try {
    const collection = await getHistoryCollection();
    
    // Build time range query
    const timeQuery: any = {};
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
    const pipeline: any[] = [
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
          pubkey: '$nodeSnapshots.pubkey',
          status: '$nodeSnapshots.status',
          latency: '$nodeSnapshots.latency',
          cpuPercent: '$nodeSnapshots.cpuPercent',
          ramPercent: '$nodeSnapshots.ramPercent',
          packetsReceived: '$nodeSnapshots.packetsReceived',
          packetsSent: '$nodeSnapshots.packetsSent',
          activeStreams: '$nodeSnapshots.activeStreams',
          uptime: '$nodeSnapshots.uptime',
          uptimePercent: '$nodeSnapshots.uptimePercent',
          storageUsed: '$nodeSnapshots.storageUsed',
          storageCapacity: '$nodeSnapshots.storageCapacity',
          version: '$nodeSnapshots.version',
          isRegistered: '$nodeSnapshots.isRegistered',
          location: '$nodeSnapshots.location',
        }
      },
      // Sort by timestamp
      { $sort: { timestamp: 1 } },
      // Limit to prevent huge results (7 days = ~1000 data points max at 10-min intervals)
      { $limit: 1000 }
    ];
    
    // Try aggregation first (faster for large datasets)
    // Add maxTimeMS to prevent queries from running too long
    let results: any[];
    try {
      results = await collection.aggregate(pipeline, { maxTimeMS: 40000 }).toArray();
    } catch (aggError: any) {
      console.warn('[MongoDB History] Aggregation failed, falling back to find query:', aggError?.message);
      // Fallback to simpler query if aggregation fails
      const simpleQuery: any = {
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
        const nodeSnapshot = snapshot.nodeSnapshots.find((n: any) => n.pubkey === pubkey);
        if (nodeSnapshot) {
          results.push({
            timestamp: snapshot.timestamp,
            ...nodeSnapshot,
          });
        }
      }
    }
    
    // Map results to expected format
    let nodeHistory = results.map((doc: any) => ({
      timestamp: doc.timestamp,
      pubkey: doc.pubkey || doc.nodeSnapshots?.pubkey,
      status: doc.status || doc.nodeSnapshots?.status,
      latency: doc.latency,
      cpuPercent: doc.cpuPercent,
      ramPercent: doc.ramPercent,
      packetsReceived: doc.packetsReceived,
      packetsSent: doc.packetsSent,
      activeStreams: doc.activeStreams,
      uptime: doc.uptime,
      uptimePercent: doc.uptimePercent,
      storageUsed: doc.storageUsed,
      storageCapacity: doc.storageCapacity,
      version: doc.version,
      isRegistered: doc.isRegistered,
      location: doc.location,
    }));
    
    // If no results with exact match, try case-insensitive (but this should be rare)
    if (nodeHistory.length === 0) {
      console.log('[MongoDB History] No exact match, trying case-insensitive search...');
      const caseInsensitivePipeline: any[] = [
        ...(Object.keys(timeQuery).length > 0 ? [{ $match: timeQuery }] : []),
        { $unwind: '$nodeSnapshots' },
        {
          $match: {
            $expr: {
              $eq: [
                { $toLower: '$nodeSnapshots.pubkey' },
                pubkey.toLowerCase()
              ]
            }
          }
        },
        {
          $project: {
            timestamp: 1,
            pubkey: '$nodeSnapshots.pubkey',
            status: '$nodeSnapshots.status',
            latency: '$nodeSnapshots.latency',
            cpuPercent: '$nodeSnapshots.cpuPercent',
            ramPercent: '$nodeSnapshots.ramPercent',
            packetsReceived: '$nodeSnapshots.packetsReceived',
            packetsSent: '$nodeSnapshots.packetsSent',
            activeStreams: '$nodeSnapshots.activeStreams',
            uptime: '$nodeSnapshots.uptime',
            uptimePercent: '$nodeSnapshots.uptimePercent',
            storageUsed: '$nodeSnapshots.storageUsed',
            storageCapacity: '$nodeSnapshots.storageCapacity',
            version: '$nodeSnapshots.version',
            isRegistered: '$nodeSnapshots.isRegistered',
            location: '$nodeSnapshots.location',
          }
        },
        { $sort: { timestamp: 1 } },
        { $limit: 1000 }
      ];
      
      try {
        const caseInsensitiveResults = await collection.aggregate(caseInsensitivePipeline, { maxTimeMS: 40000 }).toArray();
        nodeHistory = caseInsensitiveResults.map((doc: any) => ({
          timestamp: doc.timestamp,
          pubkey: doc.pubkey,
          status: doc.status,
          latency: doc.latency,
          cpuPercent: doc.cpuPercent,
          ramPercent: doc.ramPercent,
          packetsReceived: doc.packetsReceived,
          packetsSent: doc.packetsSent,
          activeStreams: doc.activeStreams,
          uptime: doc.uptime,
          uptimePercent: doc.uptimePercent,
          storageUsed: doc.storageUsed,
          storageCapacity: doc.storageCapacity,
          version: doc.version,
          isRegistered: doc.isRegistered,
          location: doc.location,
        }));
      } catch (caseError: any) {
        console.warn('[MongoDB History] Case-insensitive search failed:', caseError?.message);
      }
    }
    
    console.log('[MongoDB History] Extracted node history:', {
      pubkey,
      dataPoints: nodeHistory.length,
    });
    
    return nodeHistory;
  } catch (error: any) {
    console.error('[MongoDB History] ❌ Failed to get node history:', error?.message || error);
    return [];
  }
}

/**
 * Get aggregated daily statistics
 */
export async function getDailyStats(
  days: number = 30
): Promise<Array<{
  date: string;
  avgNodes: number;
  avgOnline: number;
  avgUptime: number;
  avgUptimePercent: number;
}>> {
  try {
    const collection = await getHistoryCollection();
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const snapshots = await collection
      .find({ timestamp: { $gte: startTime } })
      .sort({ timestamp: 1 })
      .toArray();
    
    // Group by date and calculate averages
    const dailyMap = new Map<string, {
      count: number;
      totalNodes: number;
      totalOnline: number;
      totalUptime: number;
      totalUptimePercent: number;
    }>();
    
    for (const snapshot of snapshots) {
      const existing = dailyMap.get(snapshot.date) || {
        count: 0,
        totalNodes: 0,
        totalOnline: 0,
        totalUptime: 0,
        totalUptimePercent: 0,
      };
      
      existing.count++;
      existing.totalNodes += snapshot.totalNodes;
      existing.totalOnline += snapshot.onlineNodes;
      existing.totalUptime += snapshot.avgUptime;
      existing.totalUptimePercent += snapshot.avgUptimePercent;
      
      dailyMap.set(snapshot.date, existing);
    }
    
    // Convert to array with averages
    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      avgNodes: data.totalNodes / data.count,
      avgOnline: data.totalOnline / data.count,
      avgUptime: data.totalUptime / data.count,
      avgUptimePercent: data.totalUptimePercent / data.count,
    })).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error: any) {
    console.error('[MongoDB History] ❌ Failed to get daily stats:', error?.message || error);
    return [];
  }
}

// Helper functions for calculations

function calculateAvgUptime(nodes: PNode[]): number {
  const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime !== null && n.uptime > 0);
  if (nodesWithUptime.length === 0) return 0;
  return nodesWithUptime.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodesWithUptime.length;
}

function calculateAvgUptimePercent(nodes: PNode[]): number {
  const nodesWithUptime = nodes.filter(n => {
    if (n.uptimePercent !== undefined) return true;
    if (n.uptime && n.uptime > 0) return true;
    return false;
  });
  
  if (nodesWithUptime.length === 0) return 0;
  
  const total = nodesWithUptime.reduce((sum, n) => {
    if (n.uptimePercent !== undefined) return sum + n.uptimePercent;
    if (n.uptime && n.uptime > 0) {
      // Calculate from uptime seconds (assuming 30 days = 100%)
      const uptimePercent = Math.min(99.9, (n.uptime / (30 * 24 * 3600)) * 100);
      return sum + uptimePercent;
    }
    return sum;
  }, 0);
  
  return total / nodesWithUptime.length;
}

function calculateAvgLatency(nodes: PNode[]): number {
  const nodesWithLatency = nodes.filter(n => n.latency !== undefined && n.latency !== null && n.latency > 0);
  if (nodesWithLatency.length === 0) return 0;
  return nodesWithLatency.reduce((sum, n) => sum + (n.latency || 0), 0) / nodesWithLatency.length;
}

function calculateAvgCpuPercent(nodes: PNode[]): number {
  const nodesWithCpu = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null && n.cpuPercent >= 0);
  if (nodesWithCpu.length === 0) return 0;
  return nodesWithCpu.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / nodesWithCpu.length;
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

function createNodeSnapshots(nodes: PNode[]): HistoricalSnapshot['nodeSnapshots'] {
  return nodes.map(node => {
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
      latency: node.latency !== undefined && node.latency !== null ? node.latency : undefined,
      cpuPercent: node.cpuPercent !== undefined && node.cpuPercent !== null ? node.cpuPercent : undefined,
      ramPercent,
      packetsReceived: node.packetsReceived !== undefined && node.packetsReceived !== null ? node.packetsReceived : undefined,
      packetsSent: node.packetsSent !== undefined && node.packetsSent !== null ? node.packetsSent : undefined,
      activeStreams: node.activeStreams !== undefined && node.activeStreams !== null ? node.activeStreams : undefined,
      // Cumulative metrics (track behavior over time)
      uptime: node.uptime !== undefined && node.uptime !== null ? node.uptime : undefined,
      uptimePercent: node.uptimePercent !== undefined && node.uptimePercent !== null ? node.uptimePercent : undefined,
      storageUsed: node.storageUsed !== undefined && node.storageUsed !== null ? node.storageUsed : undefined,
      storageCapacity: node.storageCapacity !== undefined && node.storageCapacity !== null ? node.storageCapacity : undefined,
      // Static-ish metadata (for context)
      version: node.version || undefined,
      isRegistered: node.isRegistered !== undefined ? node.isRegistered : undefined,
      location: node.location || (node.locationData?.city && node.locationData?.country 
        ? `${node.locationData.city}, ${node.locationData.country}` 
        : undefined),
    };
  }).filter(snapshot => snapshot.pubkey); // Only include nodes with a valid pubkey
}

