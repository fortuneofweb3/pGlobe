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
    
    // Start background refresh task
    const { startBackgroundRefresh } = await import('./lib/server/background-refresh');
    startBackgroundRefresh();
    console.log('[Instrumentation] Background refresh task started');
  }
}

