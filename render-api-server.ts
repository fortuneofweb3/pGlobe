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

import express from 'express';
import { performRefresh, startBackgroundRefresh } from './lib/server/background-refresh';
import { getAllNodes, getNodeByPubkey, createIndexes } from './lib/server/mongodb-nodes';
import { createHistoryIndexes } from './lib/server/mongodb-history';
import { fetchPNodesFromGossip } from './lib/server/prpc';
import { upsertNodes } from './lib/server/mongodb-nodes';
import { getNetworkConfig } from './lib/server/network-config';

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

// Initialize server with background refresh
async function startServer() {
  console.log('[RenderAPI] Starting server...');
  console.log('[RenderAPI] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasApiSecret: !!API_SECRET,
  });

  try {
    // Step 1: Create MongoDB indexes
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

    // Step 2: Start background refresh (instrumentation)
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

