/**
 * Sync State Manager
 * 
 * Coordinates between sync-nodes and realtime-activity to prevent
 * them from competing for the same gossip endpoints.
 */

let isSyncRunning = false;

export function setSyncRunning(running: boolean) {
    isSyncRunning = running;
    console.log(`[SyncState] Sync ${running ? 'started' : 'finished'}`);
}

export function isSyncActive(): boolean {
    return isSyncRunning;
}
