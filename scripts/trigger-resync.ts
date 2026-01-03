import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { syncNodes } from '../lib/server/sync-nodes';

async function triggerSync() {
    try {
        console.log('[Sync] 🔄 Starting full node resync...');
        const startTime = Date.now();
        await syncNodes();
        const duration = Date.now() - startTime;
        console.log(`[Sync] ✅ Full resync completed in ${duration}ms`);
        process.exit(0);
    } catch (error) {
        console.error('[Sync] ❌ Sync failed:', error);
        process.exit(1);
    }
}

triggerSync();
