
import { getNodesCollection, getManagerStatsCollection } from '../lib/server/mongodb-nodes';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        const nodesCollection = await getNodesCollection();
        const statsCollection = await getManagerStatsCollection();

        // 1. Get all managers who have registered nodes (visible in UI)
        const managersWithNodes = await nodesCollection.distinct('managerWallet', { managerWallet: { $ne: null } });
        console.log(`Found ${managersWithNodes.length} managers with registered nodes.`);

        let matchCount = 0;
        let diffCount = 0;
        let missingStatsCount = 0;

        console.log('\n--- Discrepancies (Registered != Purchased) ---');

        for (const wallet of managersWithNodes) {
            // Get registered count
            const registeredCount = await nodesCollection.countDocuments({ managerWallet: wallet });

            // Get purchased count
            const stat = await statsCollection.findOne({ wallet });

            if (!stat) {
                console.log(`[MISSING STATS] Wallet: ${wallet}, Registered: ${registeredCount}`);
                missingStatsCount++;
                continue;
            }

            const purchasedCount = stat.purchaseCount;

            if (registeredCount !== purchasedCount) {
                console.log(`[DIFF] Wallet: ${wallet.slice(0, 8)}... | Registered: ${registeredCount} | Purchased: ${purchasedCount}`);
                diffCount++;
            } else {
                matchCount++;
            }
        }

        console.log('\n--- Summary ---');
        console.log(`Total Managers Checked: ${managersWithNodes.length}`);
        console.log(`Exact Matches: ${matchCount}`);
        console.log(`Differences: ${diffCount}`);
        console.log(`Missing Purchase Stats: ${missingStatsCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
