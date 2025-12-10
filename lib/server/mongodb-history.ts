/**
 * MongoDB Historical Data Storage
 * Stores hourly snapshots of VARIABLE node metrics for trend analysis
 * 
 * NOTE: This stores only VARIABLE metrics (status, latency, CPU, RAM, packets, etc.)
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
  hour: string; // YYYY-MM-DD-HH format for aggregation
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
    
    // Index on hour for hourly aggregation queries
    await collection.createIndex({ hour: 1 });
    
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
 * Only stores one snapshot per hour (aggregates multiple refreshes)
 */
export async function storeHistoricalSnapshot(nodes: PNode[]): Promise<void> {
  try {
    const collection = await getHistoryCollection();
    const now = Date.now();
    const date = new Date(now);
    
    // Create hour identifier (YYYY-MM-DD-HH)
    const hour = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}`;
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    
    // Check if we already have a snapshot for this hour
    const existing = await collection.findOne({ hour });
    if (existing) {
      // Update existing snapshot (use latest data for the hour)
      await collection.updateOne(
        { hour },
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
      hour,
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
    console.log(`[MongoDB History] ✅ Stored snapshot for ${hour} (${nodes.length} nodes)`);
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
    const query: any = {
      'nodeSnapshots.pubkey': pubkey,
    };
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }
    
    const snapshots = await collection
      .find(query)
      .sort({ timestamp: 1 })
      .toArray();
    
    // Extract node-specific data points
    const nodeHistory: Array<HistoricalSnapshot['nodeSnapshots'][0] & { timestamp: number }> = [];
    
    for (const snapshot of snapshots) {
      const nodeSnapshot = snapshot.nodeSnapshots.find(n => n.pubkey === pubkey);
      if (nodeSnapshot) {
        nodeHistory.push({
          ...nodeSnapshot,
          timestamp: snapshot.timestamp,
        });
      }
    }
    
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
    const pubkey = node.pubkey || node.publicKey || '';
    const ramPercent = node.ramUsed && node.ramTotal && node.ramTotal > 0
      ? ((node.ramUsed / node.ramTotal) * 100)
      : undefined;
    
    return {
      pubkey,
      // Variable status metrics (change frequently)
      status: node.status || 'offline',
      latency: node.latency,
      cpuPercent: node.cpuPercent,
      ramPercent,
      packetsReceived: node.packetsReceived,
      packetsSent: node.packetsSent,
      activeStreams: node.activeStreams,
      // Cumulative metrics (track behavior over time)
      uptime: node.uptime, // Cumulative - tracks if node stays online
      uptimePercent: node.uptimePercent,
      storageUsed: node.storageUsed, // Can grow over time
      storageCapacity: node.storageCapacity,
      // Static-ish metadata (for context)
      version: node.version,
      isRegistered: node.isRegistered,
      location: node.location,
    };
  });
}

