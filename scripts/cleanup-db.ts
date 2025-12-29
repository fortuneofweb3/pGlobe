
import { cleanupInvalidNodes } from '../lib/server/mongodb-nodes';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runCleanup() {
    console.log('Starting DB cleanup...');
    try {
        const deleted = await cleanupInvalidNodes();
        console.log(`Cleanup complete. Removed ${deleted} invalid nodes.`);
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

runCleanup();
