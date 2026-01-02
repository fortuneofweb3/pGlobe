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
let syncRewardsFn: (() => Promise<{ success: boolean; count: number; error?: string }>) | null = null;
let updateManagerStatsFn: (() => Promise<{ success: boolean; count: number }>) | null = null;

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

async function getSyncRewards() {
  if (!syncRewardsFn) {
    const mod = await import('./sync-rewards');
    if (typeof mod.syncRewardsForAllManagers !== 'function') {
      throw new Error('syncRewardsForAllManagers export is not a function');
    }
    syncRewardsFn = mod.syncRewardsForAllManagers;
  }
  return syncRewardsFn;
}

async function getUpdateManagerStats() {
  if (!updateManagerStatsFn) {
    const mod = await import('./manager-discovery');
    if (typeof mod.updateManagerStats !== 'function') {
      throw new Error('updateManagerStats export is not a function');
    }
    updateManagerStatsFn = mod.updateManagerStats;
  }
  return updateManagerStatsFn;
}

let refreshInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastRefreshStart = 0;
let lastRefreshComplete = 0;
let lastRewardSyncComplete = 0;
let lastManagerStatsSyncComplete = 0;
let consecutiveSkips = 0;

// Maximum time before force-resetting isRunning
const MAX_REFRESH_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_SKIPS = 3;
const REWARD_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MANAGER_STATS_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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

      const now = Date.now();

      // Manager Stats Sync (every 10 minutes)
      if (now - lastManagerStatsSyncComplete > MANAGER_STATS_SYNC_INTERVAL_MS) {
        console.log('[BackgroundRefresh] 📊 Starting scheduled manager stats sync...');
        try {
          // Force use local definition if we are inside the same process, or use dynamic import
          const updateStats = await getUpdateManagerStats();
          if (updateStats) {
            const statsResult = await updateStats();
            if (statsResult.success) {
              lastManagerStatsSyncComplete = now;
              console.log(`[BackgroundRefresh] ✅ Manager stats updated for ${statsResult.count} records`);
            } else {
              console.warn(`[BackgroundRefresh] ⚠️ Manager stats update failed partially`);
            }
          }
        } catch (e: any) {
          console.error('[BackgroundRefresh] ❌ Manager stats sync error:', e?.message || e);
        }
      }

      // Check if it's time for a reward sync (every hour)
      if (now - lastRewardSyncComplete > REWARD_SYNC_INTERVAL_MS) {
        console.log('[BackgroundRefresh] 🎁 Starting scheduled reward sync...');
        const syncRewards = await getSyncRewards();
        if (syncRewards) {
          const rewardResult = await syncRewards();
          if (rewardResult.success) {
            lastRewardSyncComplete = now;
            console.log(`[BackgroundRefresh] ✅ Rewards synced for ${rewardResult.count} managers`);
          } else {
            console.error(`[BackgroundRefresh] ⚠️ Reward sync failed: ${rewardResult.error}`);
          }
        }
      }
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
