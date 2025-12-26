/**
 * Background Refresh Service
 * 
 * Runs node sync every 60 seconds using the simplified sync-nodes module.
 * This is a thin wrapper that handles:
 * - Interval management
 * - Concurrency control (prevent overlapping syncs)
 * - Health monitoring
 */

// Lazy import to avoid module resolution issues with tsx
let syncNodesFn: (() => Promise<{ success: boolean; count: number; error?: string }>) | null = null;

async function getSyncNodes() {
  if (!syncNodesFn) {
    const mod = await import('./sync-nodes');
    if (typeof mod.syncNodes !== 'function') {
      throw new Error('syncNodes export is not a function');
    }
    syncNodesFn = mod.syncNodes;
  }
  return syncNodesFn;
}

let refreshInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastRefreshStart = 0;
let lastRefreshComplete = 0;
let consecutiveSkips = 0;

// Maximum time before force-resetting isRunning
const MAX_REFRESH_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_SKIPS = 3;

/**
 * Check if refresh is currently running
 */
export function isRefreshRunning(): boolean {
  return isRunning;
}

/**
 * Perform a single refresh cycle
 */
export async function performRefresh(): Promise<void> {
  // Check for stuck refresh
  if (isRunning) {
    const timeSinceStart = Date.now() - lastRefreshStart;
    consecutiveSkips++;

    if (timeSinceStart > MAX_REFRESH_TIME_MS || consecutiveSkips >= MAX_CONSECUTIVE_SKIPS) {
      console.error(`[BackgroundRefresh] ❌ Force resetting stuck refresh (${Math.round(timeSinceStart / 1000)}s)`);
      isRunning = false;
      consecutiveSkips = 0;
    } else {
      console.log(`[BackgroundRefresh] ⏳ Previous refresh still running, skip ${consecutiveSkips}/${MAX_CONSECUTIVE_SKIPS}`);
      return;
    }
  }

  consecutiveSkips = 0;
  isRunning = true;
  lastRefreshStart = Date.now();

  console.log(`[BackgroundRefresh] 🔄 Starting refresh at ${new Date().toISOString()}`);

  try {
    const syncNodes = await getSyncNodes();
    if (typeof syncNodes !== 'function') {
      throw new Error('syncNodes is not a function');
    }
    const result = await syncNodes();

    if (result.success) {
      console.log(`[BackgroundRefresh] ✅ Synced ${result.count} nodes`);
    } else {
      console.error(`[BackgroundRefresh] ⚠️ Sync failed: ${result.error}`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[BackgroundRefresh] ❌ Error:`, error.message);
  } finally {
    isRunning = false;
    lastRefreshComplete = Date.now();
    const duration = lastRefreshComplete - lastRefreshStart;
    console.log(`[BackgroundRefresh] Completed in ${Math.round(duration / 1000)}s`);
  }
}

/**
 * Start background refresh (every 60 seconds)
 */
export function startBackgroundRefresh(): void {
  if (refreshInterval) {
    console.log('[BackgroundRefresh] Already running');
    return;
  }

  console.log('[BackgroundRefresh] 🚀 Starting...');

  // Initial refresh
  performRefresh().catch(err => {
    console.error('[BackgroundRefresh] Initial refresh error:', err.message);
  });

  // Set up interval
  refreshInterval = setInterval(() => {
    performRefresh().catch(err => {
      console.error('[BackgroundRefresh] Interval error:', err.message);
      isRunning = false;
    });
  }, 60 * 1000);

  // Heartbeat for monitoring
  heartbeatInterval = setInterval(() => {
    const uptime = process.uptime();
    const timeSinceComplete = lastRefreshComplete
      ? Math.floor((Date.now() - lastRefreshComplete) / 1000)
      : 0;
    console.log(`[BackgroundRefresh] 💓 Up ${Math.floor(uptime / 60)}min, last sync ${timeSinceComplete}s ago`);

    // Auto-recover if stuck
    if (lastRefreshComplete && timeSinceComplete > 10 * 60 && isRunning) {
      console.error('[BackgroundRefresh] ⚠️ Force resetting stuck state');
      isRunning = false;
    }
  }, 60 * 1000);

  console.log('[BackgroundRefresh] ✅ Started');
}

/**
 * Stop background refresh
 */
export function stopBackgroundRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  console.log('[BackgroundRefresh] 🛑 Stopped');
}
