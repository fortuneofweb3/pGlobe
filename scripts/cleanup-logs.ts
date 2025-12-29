
import { getDb } from '../lib/server/mongodb-nodes';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function cleanupLogs() {
    console.log('Starting log cleanup...');
    try {
        const db = await getDb();

        // List of collections to drop
        const collections = ['node_history', 'region_history', 'activity_logs'];

        for (const name of collections) {
            try {
                const exists = await db.listCollections({ name }).hasNext();
                if (exists) {
                    console.log(`Dropping collection: ${name}...`);
                    await db.dropCollection(name);
                    console.log(`✅ Dropped ${name}`);
                } else {
                    console.log(`Collection ${name} does not exist, skipping.`);
                }
            } catch (err: any) {
                console.error(`Error dropping ${name}:`, err.message);
            }
        }

        console.log('Log cleanup complete.');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

cleanupLogs();
