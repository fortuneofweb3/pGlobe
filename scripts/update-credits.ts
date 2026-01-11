
import { fetchMergedCredits } from '../lib/server/xandeum-api';
import { getAllNodes, upsertNodes } from '../lib/server/mongodb-nodes';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function run() {
    console.log('🚀 Starting Manual Credit Update...');

    try {
        // 1. Fetch credits from APIs
        const { creditsMap, mainnetPods, devnetPods } = await fetchMergedCredits();
        console.log(`✅ Fetched credits: ${mainnetPods.size} Mainnet, ${devnetPods.size} Devnet`);

        // 2. Fetch all nodes from DB
        const nodes = await getAllNodes();
        console.log(`✅ Fetched ${nodes.length} nodes from database`);

        const currentMonth = new Date().toISOString().slice(0, 7);
        let updatedCount = 0;

        // 3. Update nodes in-memory
        for (const node of nodes) {
            const pk = node.pubkey || node.publicKey;
            if (!pk) continue;

            const mainnetCredits = mainnetPods.get(pk);
            const devnetCredits = devnetPods.get(pk);
            const mergedCredits = creditsMap.get(pk);

            let changed = false;

            if (mainnetCredits !== undefined && node.mainnetCredits !== mainnetCredits) {
                node.mainnetCredits = mainnetCredits;
                changed = true;
            }
            if (devnetCredits !== undefined && node.devnetCredits !== devnetCredits) {
                node.devnetCredits = devnetCredits;
                changed = true;
            }
            if (mergedCredits !== undefined && node.credits !== mergedCredits) {
                node.credits = mergedCredits;
                changed = true;
            }

            const newNetwork = mainnetCredits !== undefined ? 'mainnet' : (devnetCredits !== undefined ? 'devnet' : node.network);
            if (node.network !== newNetwork) {
                node.network = newNetwork;
                changed = true;
            }

            if (changed) {
                node.creditsResetMonth = currentMonth;
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            console.log(`💾 Saving ${updatedCount} updated nodes to DB...`);
            // Use skipMarkOffline = true to prevent marking other nodes as offline
            await upsertNodes(nodes, true);
            console.log('✅ Update complete!');
        } else {
            console.log('👍 All nodes are already up to date.');
        }

    } catch (err) {
        console.error('❌ Error during update:', err);
    } finally {
        process.exit(0);
    }
}

run();
