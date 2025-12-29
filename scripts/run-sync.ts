
import dotenv from 'dotenv';
import { syncNodes } from '@/lib/server/sync-nodes';
import { clearBalanceCache } from '@/lib/server/balance-cache';

// Load environment variables
dotenv.config();

async function main() {
    console.log('🚀 Starting manual sync...');

    // Clear cache to force fresh fetch
    clearBalanceCache();

    try {
        const result = await syncNodes();
        console.log('------------------------------------------------');
        console.log(`✅ Sync Complete!`);
        console.log(`Success: ${result.success}`);
        console.log(`Count: ${result.count}`);
        if (result.error) console.error(`Error: ${result.error}`);
        console.log('------------------------------------------------');
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('Fatal error during sync:', error);
        process.exit(1);
    }
}

main();
