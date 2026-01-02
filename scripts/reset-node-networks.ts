
import { getDb } from '../lib/server/mongodb-nodes';

async function resetNetworks() {
    try {
        const db = await getDb();
        console.log('[Reset] 🔄 Resetting network and credit fields for all nodes...');

        const result = await db.collection('nodes').updateMany(
            {},
            {
                $set: {
                    network: 'unknown',
                    credits: 0,
                    mainnetCredits: 0,
                    devnetCredits: 0,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`[Reset] ✅ Successfully reset ${result.modifiedCount} nodes.`);
        process.exit(0);
    } catch (error) {
        console.error('[Reset] ❌ Failed to reset networks:', error);
        process.exit(1);
    }
}

resetNetworks();
