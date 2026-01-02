
import { config } from 'dotenv';
import { getManagerPurchaseStats } from '../lib/server/manager-discovery';
import { getManagerStatsCollection } from '../lib/server/mongodb-nodes';

// Load environment variables
config({ path: '.env.local' });
config();

async function main() {
    try {
        console.log('Starting manager purchase stats backfill...');

        // 1. Fetch stats from on-chain (using existing logic)
        console.log('Fetching on-chain data...');
        const stats = await getManagerPurchaseStats();
        console.log(`Fetched stats for ${stats.size} managers.`);

        // 2. Connect to DB
        console.log('Connecting to MongoDB...');
        const collection = await getManagerStatsCollection();

        // 3. Upsert into DB
        let upserted = 0;
        let errors = 0;

        for (const [wallet, count] of stats.entries()) {
            try {
                await collection.updateOne(
                    { wallet },
                    {
                        $set: {
                            wallet,
                            purchaseCount: count,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
                upserted++;
            } catch (err) {
                console.error(`Failed to upsert for ${wallet}:`, err);
                errors++;
            }
        }

        console.log('----------------------------------------');
        console.log(`Backfill complete.`);
        console.log(`- Upserted/Updated: ${upserted}`);
        console.log(`- Errors: ${errors}`);
        console.log('----------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();
