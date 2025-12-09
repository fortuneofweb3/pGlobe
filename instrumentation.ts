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
    
    // Note: Background refresh is handled by client-side triggers
    // On Vercel Hobby plan, we use client-side code to trigger /api/refresh-nodes when users visit
    // This keeps MongoDB updated without needing Vercel Pro or external cron services
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

