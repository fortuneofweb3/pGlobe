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
// This must be done with require() to ensure it runs before ES module imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

// Now import other modules (they can safely read process.env)
import express from 'express';
import { performRefresh, startBackgroundRefresh } from './lib/server/background-refresh';
import { getAllNodes, getNodeByPubkey, createIndexes } from './lib/server/mongodb-nodes';
import { createHistoryIndexes, getHistoricalSnapshots, getDailyStats, getNodeHistory } from './lib/server/mongodb-history';
import { fetchPNodesFromGossip } from './lib/server/prpc';
import { upsertNodes } from './lib/server/mongodb-nodes';
import { getNetworkConfig } from './lib/server/network-config';
import { calculateNetworkHealth } from './lib/utils/network-health';
import { PNode } from './lib/types/pnode';

const app = express();
const PORT = process.env.PORT || 3001;
const API_SECRET = process.env.API_SECRET; // Secret for Vercel to authenticate

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/refresh-nodes
 * Triggers background refresh (pRPC fetch + DB write)
 */
app.post('/api/refresh-nodes', authenticate, async (req, res) => {
  try {
    console.log('[RenderAPI] Refresh request received');
    await performRefresh();
    console.log('[RenderAPI] ✅ Refresh completed');
    
    // Get summary
    let totalInDb = null;
    try {
      const nodes = await getAllNodes();
      totalInDb = nodes.length;
    } catch (err) {
      console.warn('[RenderAPI] Could not read back from DB:', err);
    }
    
    res.json({
      success: true,
      message: 'Background refresh completed',
      totalInDb,
      timestamp: new Date().toISOString(),
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
 * Syncs nodes from pRPC to DB
 */
app.post('/api/sync-nodes', authenticate, async (req, res) => {
  try {
    const networkId = req.query.network as string || 'devnet1';
    const networkConfig = getNetworkConfig(networkId);
    
    if (!networkConfig) {
      return res.status(400).json({ error: `Network ${networkId} not found` });
    }

    console.log(`[RenderAPI] Sync request for network: ${networkConfig.name}`);

    // Fetch from pRPC
    const nodes = await fetchPNodesFromGossip(networkConfig.rpcUrl);
    console.log(`[RenderAPI] Fetched ${nodes.length} nodes from gossip`);

    // Write to DB
    await upsertNodes(nodes);
    console.log(`[RenderAPI] Upserted ${nodes.length} nodes to database`);

    // Get total count
    const dbNodes = await getAllNodes();

    res.json({
      success: true,
      fetched: nodes.length,
      upserted: nodes.length,
      totalInDB: dbNodes.length,
      message: `Synced ${nodes.length} nodes to database`,
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
 */
app.get('/api/pnodes', authenticate, async (req, res) => {
  try {
    const networkId = req.query.network as string;
    const refresh = req.query.refresh === 'true';

    // If refresh requested, trigger it but return cached data
    if (refresh) {
      performRefresh().catch(err => {
        console.error('[RenderAPI] Background refresh failed:', err);
      });
    }

    // Always return from DB (fast)
    const nodes = await getAllNodes();
    console.log(`[RenderAPI] Returning ${nodes.length} nodes from DB`);

    res.json({
      nodes,
      count: nodes.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[RenderAPI] ❌ Failed to get nodes:', error);
    res.status(500).json({
      error: 'Failed to fetch nodes',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/nodes/:id
 * Returns single node by ID/pubkey
 */
app.get('/api/nodes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const node = await getNodeByPubkey(id);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node });
  } catch (error: any) {
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
    const node = await getNodeByPubkey(id);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node });
  } catch (error: any) {
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
    storageUsed: node.storageUsed,
    storageCommitted: node.storageCommitted,
    storageUsagePercent: node.storageUsagePercent,
    packetsReceived: node.packetsReceived,
    packetsSent: node.packetsSent,
    activeStreams: node.activeStreams,
    latency: node.latency,
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
    
    // Get all nodes
    let nodes = await getAllNodes();

    // Apply filters
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
    const node = await getNodeByPubkey(id);
    
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
    const nodes = await getAllNodes();
    
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

    const nodesWithLatency = nodes.filter(n => n.latency !== undefined);
    const avgLatency = nodesWithLatency.length > 0
      ? nodesWithLatency.reduce((sum, n) => sum + (n.latency || 0), 0) / nodesWithLatency.length
      : null;

    const totalStorage = nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
    const usedStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const storageUsagePercent = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;

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
        latency: {
          average: avgLatency,
        },
        storage: {
          total: totalStorage,
          used: usedStorage,
          usagePercent: storageUsagePercent,
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
    const nodes = await getAllNodes();
    
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

