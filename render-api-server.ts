/**
 * API Server for Render
 * 
 * This server handles all backend operations:
 * - Background refresh (instrumentation) - runs every minute
 * - pRPC fetching from gossip
 * - MongoDB writes
 * - API endpoints for Vercel to call
 * 
 * Deploy this as a Web Service on Render
 */

// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

// Now import other modules (they can safely read process.env)
import express from 'express';
import { performRefresh, startBackgroundRefresh, isRefreshRunning } from './lib/server/background-refresh';
import { getAllNodes, getNodeByPubkey, createIndexes, upsertNodes } from './lib/server/mongodb-nodes';
import { createHistoryIndexes, getHistoricalSnapshots, getDailyStats, getNodeHistory } from './lib/server/mongodb-history';
import { syncNodes, fetchAllNodes } from './lib/server/sync-nodes';
import { getNetworkConfig } from './lib/server/network-config';
import { calculateNetworkHealth } from './lib/utils/network-health';
import { PNode } from './lib/types/pnode';

const app = express();
const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_SECRET; // Secret for Vercel to authenticate

// In-memory cache for nodes - always returns last known good data
let cachedNodes: PNode[] = [];
let cacheTimestamp: Date | null = null;
let lastSuccessfulFetch: Date | null = null;

// Update cache with fresh data
const updateCache = (nodes: PNode[]) => {
  cachedNodes = nodes;
  cacheTimestamp = new Date();
  lastSuccessfulFetch = new Date();
  console.log(`[Cache] ✅ Updated cache with ${nodes.length} nodes`);
};

// Get nodes - try DB first, fall back to cache
const getNodesWithFallback = async (): Promise<{ nodes: PNode[]; fromCache: boolean }> => {
  try {
    const nodes = await getAllNodes();
    if (nodes.length > 0) {
      updateCache(nodes);
      return { nodes, fromCache: false };
    }
    // If DB returns empty but we have cache, use cache
    if (cachedNodes.length > 0) {
      console.log(`[Cache] ⚠️  DB returned 0 nodes, using cached ${cachedNodes.length} nodes`);
      return { nodes: cachedNodes, fromCache: true };
    }
    // If no cache and DB is empty, return empty (but log it)
    console.log(`[Cache] ⚠️  No nodes in DB and no cache available`);
    return { nodes: [], fromCache: false };
  } catch (error: any) {
    console.error('[Cache] ⚠️  DB read failed, using cache:', error?.message);
    if (cachedNodes.length > 0) {
      console.log(`[Cache] ✅ Returning ${cachedNodes.length} cached nodes (DB unavailable)`);
      return { nodes: cachedNodes, fromCache: true };
    }
    // Last resort - return empty but log warning
    console.error(`[Cache] ❌ No cache available and DB failed - returning empty array`);
    return { nodes: [], fromCache: false };
  }
};

// Middleware
app.use(express.json());

// Auth middleware - Vercel calls must include API_SECRET
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!API_SECRET) {
    // If no secret set, allow all (for development)
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized - Invalid or missing API_SECRET' });
  }
  next();
};

// Health check endpoint (used by external cron jobs to keep service awake)
app.get('/health', async (req, res) => {
  try {
    const uptime = process.uptime();
    const uptimeMinutes = Math.floor(uptime / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    
    // Quick MongoDB ping to verify connection
    let dbStatus = 'unknown';
    try {
      const { getDb } = await import('./lib/server/mongodb-nodes');
      const db = await getDb();
      await db.admin().ping();
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'disconnected';
    }
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      uptimeFormatted: `${uptimeHours}h ${uptimeMinutes % 60}m`,
      database: dbStatus,
      message: 'Background refresh service running',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * POST /api/refresh-nodes
 * Triggers background refresh (pRPC fetch + DB write)
 */
app.post('/api/refresh-nodes', authenticate, async (req, res) => {
  try {
    console.log('[RenderAPI] Refresh request received');
    
    // Always respond to client requests
    // If refresh is already running, return status immediately with cached data
    if (isRefreshRunning()) {
      console.log('[RenderAPI] ⏳ Background refresh already in progress');
      
      // Return cached data instead of trying to read from DB
      const { nodes, fromCache } = await getNodesWithFallback();
      console.log(`[RenderAPI] Returning ${nodes.length} nodes ${fromCache ? 'from cache' : 'from DB'} while refresh in progress`);
      
      return res.json({
        success: true,
        message: 'Background refresh already in progress',
        inProgress: true,
        nodes,
        count: nodes.length,
        totalInDb: nodes.length,
        timestamp: new Date().toISOString(),
        fromCache,
      });
    }
    
    // Trigger refresh (performRefresh handles its own concurrency)
    await performRefresh();
    console.log('[RenderAPI] ✅ Refresh completed');
    
    // Get summary using cache-aware fetch (will have fresh data now)
    const { nodes, fromCache } = await getNodesWithFallback();
    
    res.json({
      success: true,
      message: 'Background refresh completed',
      inProgress: false,
      nodes,
      count: nodes.length,
      totalInDb: nodes.length,
      timestamp: cacheTimestamp?.toISOString() || new Date().toISOString(),
      fromCache,
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Refresh failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/sync-nodes
 * Syncs nodes from pRPC to DB using the simplified sync service
 */
app.post('/api/sync-nodes', authenticate, async (req, res) => {
  try {
    console.log('[RenderAPI] Sync request received');

    // Use the new simplified sync service
    const result = await syncNodes();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Sync failed',
      });
    }

    // Get total count - use cache-aware fetch
    const { nodes: dbNodes } = await getNodesWithFallback();

    res.json({
      success: true,
      fetched: result.count,
      totalInDB: dbNodes.length,
      message: `Synced ${result.count} nodes to database`,
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Sync failed:', error);
    res.status(500).json({
      error: 'Failed to sync nodes',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/pnodes
 * Returns all nodes from DB (read-only, no pRPC)
 * ALWAYS responds to client requests, even if DB is unavailable
 */
app.get('/api/pnodes', authenticate, async (req, res) => {
  try {
    const networkId = req.query.network as string;
    const refresh = req.query.refresh === 'true';

    // If refresh requested, trigger it but return cached data (non-blocking)
    if (refresh) {
      performRefresh().catch(err => {
        console.error('[RenderAPI] Background refresh failed:', err);
      });
    }

    // Always return from DB (fast), fall back to cache if DB fails
    const { nodes, fromCache } = await getNodesWithFallback();
    
    if (fromCache) {
      console.log(`[RenderAPI] Returning ${nodes.length} nodes from cache (DB unavailable or empty)`);
      res.json({
        nodes,
        count: nodes.length,
        timestamp: cacheTimestamp?.toISOString() || new Date().toISOString(),
        fromCache: true,
        warning: 'Database temporarily unavailable, showing cached data',
      });
    } else {
      console.log(`[RenderAPI] Returning ${nodes.length} nodes from DB`);
      res.json({
        nodes,
        count: nodes.length,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    // Final safety net - always respond with cached data if available
    console.error('[RenderAPI] ❌ Failed to get nodes:', error);
    if (cachedNodes.length > 0) {
      console.log(`[RenderAPI] ✅ Returning ${cachedNodes.length} cached nodes as fallback`);
      res.json({
        nodes: cachedNodes,
        count: cachedNodes.length,
        timestamp: cacheTimestamp?.toISOString() || new Date().toISOString(),
        fromCache: true,
        error: 'Failed to fetch fresh data, showing cached data',
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch nodes',
        message: error?.message || 'Unknown error',
        nodes: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }
});

/**
 * GET /api/nodes/:id
 * Returns single node by ID/pubkey
 */
app.get('/api/nodes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let node: PNode | null = null;
    
    try {
      node = await getNodeByPubkey(id);
    } catch (dbError: any) {
      console.error('[RenderAPI] ⚠️  DB read failed:', dbError?.message);
      return res.status(500).json({
        error: 'Database temporarily unavailable',
        message: dbError?.message || 'Unknown error',
      });
    }
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node });
  } catch (error: any) {
    // Final safety net - always respond
    console.error('[RenderAPI] ❌ Failed to get node:', error);
    res.status(500).json({
      error: 'Failed to fetch node',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/nodes/:id/stats
 * Returns node stats (alias for /api/nodes/:id)
 */
app.get('/api/nodes/:id/stats', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let node: PNode | null = null;
    
    try {
      node = await getNodeByPubkey(id);
    } catch (dbError: any) {
      console.error('[RenderAPI] ⚠️  DB read failed:', dbError?.message);
      return res.status(500).json({
        error: 'Database temporarily unavailable',
        message: dbError?.message || 'Unknown error',
      });
    }
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node });
  } catch (error: any) {
    // Final safety net - always respond
    console.error('[RenderAPI] ❌ Failed to get node stats:', error);
    res.status(500).json({
      error: 'Failed to fetch node stats',
      message: error?.message || 'Unknown error',
    });
  }
});

// Helper function to format node for API
function formatNodeForAPI(node: PNode): any {
  return {
    id: node.id,
    pubkey: node.pubkey || node.publicKey,
    address: node.address,
    version: node.version,
    status: node.status,
    uptime: node.uptime,
    cpuPercent: node.cpuPercent,
    ramUsed: node.ramUsed,
    ramTotal: node.ramTotal,
    storageCapacity: node.storageCapacity,
    packetsReceived: node.packetsReceived,
    packetsSent: node.packetsSent,
    activeStreams: node.activeStreams,
    location: node.location,
    locationData: node.locationData,
    lastSeen: node.lastSeen,
    peerCount: node.peerCount,
    balance: node.balance,
    isPublic: node.isPublic,
    rpcPort: node.rpcPort,
    dataOperationsHandled: node.dataOperationsHandled,
    totalPages: node.totalPages,
  };
}

/**
 * GET /api/v1/nodes
 * Public API v1: List all nodes
 */
app.get('/api/v1/nodes', authenticate, async (req, res) => {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    
    // Get all nodes - use cache-aware fetch
    const { nodes: allNodes, fromCache } = await getNodesWithFallback();
    
    if (fromCache && allNodes.length > 0) {
      console.log(`[RenderAPI] ⚠️  Using ${allNodes.length} cached nodes (DB unavailable)`);
    }

    // Apply filters
    let nodes = allNodes;
    const status = searchParams.get('status');
    if (status) {
      nodes = nodes.filter(n => n.status === status);
    }

    const version = searchParams.get('version');
    if (version) {
      nodes = nodes.filter(n => n.version === version);
    }

    const country = searchParams.get('country');
    if (country) {
      nodes = nodes.filter(n => n.locationData?.countryCode === country || n.locationData?.country === country);
    }

    const minUptime = searchParams.get('min_uptime');
    if (minUptime) {
      const min = parseFloat(minUptime);
      nodes = nodes.filter(n => n.uptime !== undefined && n.uptime >= min);
    }

    const minStorage = searchParams.get('min_storage');
    if (minStorage) {
      const min = parseInt(minStorage);
      nodes = nodes.filter(n => n.storageCapacity !== undefined && n.storageCapacity >= min);
    }

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'uptime';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    
    nodes.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = (page - 1) * limit;
    const paginatedNodes = nodes.slice(offset, offset + limit);

    // Format response
    const formattedNodes = paginatedNodes.map(node => formatNodeForAPI(node));

    res.json({
      success: true,
      data: formattedNodes,
      meta: {
        total: nodes.length,
        page,
        limit,
        totalPages: Math.ceil(nodes.length / limit),
      },
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get v1 nodes:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch nodes',
    });
  }
});

/**
 * GET /api/v1/nodes/:id
 * Public API v1: Get single node by ID/pubkey
 */
app.get('/api/v1/nodes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let node: PNode | null = null;
    
    try {
      node = await getNodeByPubkey(id);
    } catch (dbError: any) {
      console.error('[RenderAPI] ⚠️  DB read failed:', dbError?.message);
      return res.status(500).json({
        success: false,
        error: 'Database temporarily unavailable',
        message: dbError?.message || 'Unknown error',
      });
    }
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
      });
    }

    res.json({
      success: true,
      data: formatNodeForAPI(node),
    });
  } catch (error: any) {
    // Final safety net - always respond
    console.error('[RenderAPI] ❌ Failed to get v1 node:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch node',
    });
  }
});

/**
 * GET /api/v1/network/health
 * Public API v1: Network health metrics
 */
app.get('/api/v1/network/health', authenticate, async (req, res) => {
  try {
    const { nodes } = await getNodesWithFallback();
    
    if (nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No nodes found',
      });
    }

    // Calculate health metrics
    const onlineNodes = nodes.filter(n => n.status === 'online');
    const offlineNodes = nodes.filter(n => n.status === 'offline');
    const syncingNodes = nodes.filter(n => n.status === 'syncing');

    const totalUptime = nodes.reduce((sum, n) => sum + (n.uptime || 0), 0);
    const avgUptime = nodes.length > 0 ? totalUptime / nodes.length : 0;

    const totalStorage = nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);

    const totalCPU = nodes.filter(n => n.cpuPercent !== undefined).reduce((sum, n) => sum + (n.cpuPercent || 0), 0);
    const avgCPU = nodes.filter(n => n.cpuPercent !== undefined).length > 0
      ? totalCPU / nodes.filter(n => n.cpuPercent !== undefined).length
      : null;

    // Calculate network health score
    const healthScore = calculateNetworkHealth(nodes);

    // Version distribution
    const versionCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const version = node.version || 'unknown';
      versionCounts[version] = (versionCounts[version] || 0) + 1;
    });

    // Geographic distribution
    const countryCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const country = node.locationData?.countryCode || 'unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        healthScore,
        totalNodes: nodes.length,
        onlineNodes: onlineNodes.length,
        offlineNodes: offlineNodes.length,
        syncingNodes: syncingNodes.length,
        uptime: {
          average: avgUptime,
          averageDays: avgUptime / 86400,
        },
        storage: {
          total: totalStorage,
        },
        cpu: {
          average: avgCPU,
        },
        versionDistribution: versionCounts,
        geographicDistribution: countryCounts,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get network health:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to calculate network health',
    });
  }
});

/**
 * GET /api/v1/network/stats
 * Public API v1: Network statistics
 */
app.get('/api/v1/network/stats', authenticate, async (req, res) => {
  try {
    // Always respond, use cache if DB fails
    const { nodes, fromCache } = await getNodesWithFallback();
    
    if (fromCache && nodes.length > 0) {
      console.log(`[RenderAPI] ⚠️  Using ${nodes.length} cached nodes for stats (DB unavailable)`);
    }
    
    if (nodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No nodes found',
      });
    }

    // Aggregate statistics
    const stats = {
      totalNodes: nodes.length,
      totalStorage: nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0),
      totalRAM: nodes.reduce((sum, n) => sum + (n.ramTotal || 0), 0),
      totalPacketsReceived: nodes.reduce((sum, n) => sum + (n.packetsReceived || 0), 0),
      totalPacketsSent: nodes.reduce((sum, n) => sum + (n.packetsSent || 0), 0),
      totalDataOperations: nodes.reduce((sum, n) => sum + (n.dataOperationsHandled || 0), 0),
      totalPeers: nodes.reduce((sum, n) => sum + (n.peerCount || 0), 0),
      publicNodes: nodes.filter(n => n.isPublic).length,
      uniqueCountries: new Set(nodes.map(n => n.locationData?.countryCode).filter(Boolean)).size,
      uniqueVersions: new Set(nodes.map(n => n.version).filter(Boolean)).size,
    };

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get network stats:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch network stats',
    });
  }
});

/**
 * GET /api/history
 * Returns historical snapshots from MongoDB
 */
app.get('/api/history', authenticate, async (req, res) => {
  try {
    const summary = req.query.summary === 'true';
    const nodeId = req.query.nodeId as string | undefined;
    const days = parseInt(req.query.days as string || '30');
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    
    // Get node-specific history
    if (nodeId) {
      console.log('[RenderAPI] Fetching node history:', {
        nodeId,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      });
      const nodeHistory = await getNodeHistory(nodeId, startTime, endTime);
      console.log('[RenderAPI] Node history result:', {
        nodeId,
        count: nodeHistory.length,
        firstTimestamp: nodeHistory[0]?.timestamp ? new Date(nodeHistory[0].timestamp).toISOString() : undefined,
        lastTimestamp: nodeHistory[nodeHistory.length - 1]?.timestamp ? new Date(nodeHistory[nodeHistory.length - 1].timestamp).toISOString() : undefined,
      });
      return res.json({
        nodeId,
        data: nodeHistory,
        count: nodeHistory.length,
      });
    }
    
    // Get summary statistics
    if (summary) {
      const dailyStats = await getDailyStats(days);
      const snapshots = await getHistoricalSnapshots(
        startTime || (Date.now() - days * 24 * 60 * 60 * 1000),
        endTime
      );
      
      if (snapshots.length === 0) {
        return res.json({
          totalDataPoints: 0,
          dateRange: { start: Date.now(), end: Date.now() },
          avgNodesOverTime: 0,
          avgUptimeOverTime: 0,
          dailyStats: [],
        });
      }
      
      const avgNodes = snapshots.reduce((sum, s) => sum + s.totalNodes, 0) / snapshots.length;
      const avgUptime = snapshots.reduce((sum, s) => sum + s.avgUptimePercent, 0) / snapshots.length;
      
      return res.json({
        totalDataPoints: snapshots.length,
        dateRange: {
          start: snapshots[0]?.timestamp || Date.now(),
          end: snapshots[snapshots.length - 1]?.timestamp || Date.now(),
        },
        avgNodesOverTime: Math.round(avgNodes),
        avgUptimeOverTime: Math.round(avgUptime * 100) / 100,
        dailyStats,
      });
    }
    
    // Get full historical snapshots
    const snapshots = await getHistoricalSnapshots(startTime, endTime, 1000);
    
    return res.json({
      data: snapshots,
      count: snapshots.length,
      message: 'Historical data from MongoDB',
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get history:', error);
    res.status(500).json({
      error: 'Failed to fetch historical data',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/history/region
 * Returns aggregated historical data for a region (country)
 * Query params:
 *   - country: country name (required)
 *   - countryCode: optional country code (ISO 2-letter)
 *   - startTime: optional start timestamp (ms)
 *   - endTime: optional end timestamp (ms)
 * Returns: { data: [...aggregated data points], count: number }
 */
app.get('/api/history/region', authenticate, async (req, res) => {
  try {
    const country = req.query.country as string | undefined;
    if (!country) {
      return res.status(400).json({
        error: 'country parameter is required',
        data: [],
        count: 0,
      });
    }

    const countryCode = req.query.countryCode as string | undefined;
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;

    console.log('[RenderAPI] Fetching region history:', {
      country,
      countryCode,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
    });

    const { getRegionHistory } = await import('./lib/server/mongodb-history');
    const regionData = await getRegionHistory(country, countryCode, startTime, endTime);

    console.log(`[RenderAPI] ✅ Region history: ${regionData.length} data points for ${country}`);

    res.json({
      success: true,
      data: regionData,
      count: regionData.length,
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to fetch region history:', error);
    res.status(500).json({
      error: 'Failed to fetch region history',
      message: error?.message || 'Unknown error',
      data: [],
      count: 0,
    });
  }
});

/**
 * GET /api/history/bulk
 * Returns historical snapshots for multiple nodes in one request
 * Query params:
 *   - nodeIds: comma-separated list of node IDs
 *   - startTime: optional start timestamp (ms)
 *   - endTime: optional end timestamp (ms)
 * Returns: { data: { [nodeId]: [...snapshots] }, count: number }
 */
app.get('/api/history/bulk', authenticate, async (req, res) => {
  try {
    const nodeIdsParam = req.query.nodeIds as string | undefined;
    if (!nodeIdsParam) {
      return res.status(400).json({
        error: 'nodeIds parameter is required (comma-separated list)',
        data: {},
        count: 0,
      });
    }

    const nodeIds = nodeIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;

    console.log('[RenderAPI] Fetching bulk node history:', {
      nodeCount: nodeIds.length,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
    });

    // Fetch histories for all nodes in parallel
    const historyPromises = nodeIds.map(async (nodeId) => {
      try {
        const history = await getNodeHistory(nodeId, startTime, endTime);
        return { nodeId, history };
      } catch (err) {
        console.warn(`[RenderAPI] Failed to fetch history for node ${nodeId}:`, err);
        return { nodeId, history: [] };
      }
    });

    const results = await Promise.all(historyPromises);

    // Build response object with nodeId as keys
    const data: Record<string, any[]> = {};
    let totalPoints = 0;

    results.forEach(({ nodeId, history }) => {
      data[nodeId] = history;
      totalPoints += history.length;
    });

    console.log('[RenderAPI] Bulk history result:', {
      nodeCount: nodeIds.length,
      totalPoints,
      avgPointsPerNode: Math.round(totalPoints / nodeIds.length),
    });

    return res.json({
      data,
      count: totalPoints,
      nodeCount: nodeIds.length,
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get bulk history:', error);
    res.status(500).json({
      error: 'Failed to fetch bulk historical data',
      message: error?.message || 'Unknown error',
      data: {},
      count: 0,
    });
  }
});

// Initialize server with background refresh
async function startServer() {
  console.log('[RenderAPI] Starting server...');
  console.log('[RenderAPI] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasApiSecret: !!API_SECRET,
  });

  try {
    // Step 1: Create MongoDB indexes (this also tests the connection)
    console.log('[RenderAPI] Creating MongoDB indexes...');
    await createIndexes();
    console.log('[RenderAPI] ✅ MongoDB indexes created');
    
    // Create historical data indexes
    try {
      await createHistoryIndexes();
      console.log('[RenderAPI] ✅ Historical data indexes created');
    } catch (error: any) {
      console.warn('[RenderAPI] ⚠️  Failed to create history indexes:', error?.message || error);
    }

    // Step 2: Verify MongoDB connection before starting background refresh
    const { getDb } = await import('./lib/server/mongodb-nodes');
    try {
      const db = await getDb();
      await db.admin().command({ ping: 1 });
      console.log('[RenderAPI] ✅ MongoDB connection verified');
    } catch (error: any) {
      console.error('[RenderAPI] ❌ MongoDB connection failed - background refresh will not start');
      console.error('[RenderAPI] Error:', error?.message || error);
      throw new Error('MongoDB connection required for background refresh');
    }

    // Step 3: Start background refresh (only if MongoDB is connected)
    console.log('[RenderAPI] Starting background refresh task...');
    startBackgroundRefresh();
    console.log('[RenderAPI] ✅ Background refresh started (runs every 1 minute)');

    // Step 3: Start Express server
    app.listen(PORT, () => {
      console.log(`[RenderAPI] 🚀 API server running on port ${PORT}`);
      console.log(`[RenderAPI] Background refresh active - data updates every minute`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[RenderAPI] SIGTERM received, shutting down gracefully...');
      const { stopBackgroundRefresh } = await import('./lib/server/background-refresh');
      stopBackgroundRefresh();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[RenderAPI] SIGINT received, shutting down gracefully...');
      const { stopBackgroundRefresh } = await import('./lib/server/background-refresh');
      stopBackgroundRefresh();
      process.exit(0);
    });

  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the server
startServer();

