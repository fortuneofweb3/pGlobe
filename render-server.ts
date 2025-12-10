/**
 * Background Refresh Server for Render
 * 
 * This server runs the background refresh task continuously (like local instrumentation)
 * It connects to MongoDB and refreshes node data every minute
 * 
 * Deploy this as a Background Worker on Render
 */

async function startServer() {
  console.log('[RenderServer] Starting background refresh server...');
  console.log('[RenderServer] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    prpcEndpoint: process.env.NEXT_PUBLIC_PRPC_ENDPOINT,
  });

  try {
    // Step 1: Create MongoDB indexes (like instrumentation.ts does)
    console.log('[RenderServer] Creating MongoDB indexes...');
    const mongodbNodes = await import('./lib/server/mongodb-nodes');
    await mongodbNodes.createIndexes();
    console.log('[RenderServer] ✅ MongoDB indexes created');

    // Step 2: Start background refresh (like local instrumentation)
    console.log('[RenderServer] Starting background refresh task...');
    const backgroundRefresh = await import('./lib/server/background-refresh');
    backgroundRefresh.startBackgroundRefresh();
    console.log('[RenderServer] ✅ Background refresh task started (runs every 1 minute)');

    // Step 3: Keep process alive and handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[RenderServer] SIGTERM received, shutting down gracefully...');
      const backgroundRefresh = await import('./lib/server/background-refresh');
      backgroundRefresh.stopBackgroundRefresh();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[RenderServer] SIGINT received, shutting down gracefully...');
      const backgroundRefresh = await import('./lib/server/background-refresh');
      backgroundRefresh.stopBackgroundRefresh();
      process.exit(0);
    });

    console.log('[RenderServer] 🚀 Server running - background refresh active');
    console.log('[RenderServer] Press Ctrl+C to stop');

  } catch (error: any) {
    console.error('[RenderServer] ❌ Failed to start server:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the server
startServer();

