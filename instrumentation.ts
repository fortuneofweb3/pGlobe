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
    
    // Note: Background refresh is handled by Vercel Cron Jobs (see vercel.json)
    // On Vercel, serverless functions can't run setInterval, so we use cron instead
    // The cron job calls /api/cron/refresh-nodes every minute
    // For local development, you can manually trigger it or use a different approach
    if (process.env.VERCEL) {
      console.log('[Instrumentation] Running on Vercel - background refresh handled by Cron Jobs');
    } else {
      // For local development, start the interval-based refresh
      const { startBackgroundRefresh } = await import('./lib/server/background-refresh');
      startBackgroundRefresh();
      console.log('[Instrumentation] Background refresh task started (local development)');
    }
  }
}

