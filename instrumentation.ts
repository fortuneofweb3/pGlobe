/**
 * Next.js instrumentation file
 * Runs when the server starts to initialize background tasks
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side
    // Create MongoDB indexes for faster queries
    try {
      const { createIndexes } = await import('./lib/server/mongodb-nodes');
      await createIndexes();
      console.log('[Instrumentation] MongoDB indexes created');
    } catch (error) {
      console.error('[Instrumentation] Failed to create indexes:', error);
    }
    
    // Background refresh strategy:
    // - LOCAL: Use setInterval (runs every 1 min automatically)
    // - VERCEL: Client-side triggers /api/refresh-nodes when users visit (no setInterval - serverless can't run it)
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      console.log('[Instrumentation] Running on Vercel - background refresh handled by client-side triggers');
      console.log('[Instrumentation] VERCEL_ENV:', process.env.VERCEL_ENV);
    } else {
      // For local development, start the interval-based refresh
      const { startBackgroundRefresh } = await import('./lib/server/background-refresh');
      startBackgroundRefresh();
      console.log('[Instrumentation] Background refresh task started (local development)');
    }
  }
}

