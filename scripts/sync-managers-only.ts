
import dotenv from 'dotenv';
import { getAllNodes, upsertNodes } from '@/lib/server/mongodb-nodes';
import { enrichPNodesWithOnChainData } from '@/lib/server/solana-pnodes';

// Load environment variables
dotenv.config();

async function main() {
    console.log('🚀 Starting Manager-Only Sync...');

    try {
        // 1. Get all nodes from DB
        console.log('📥 Fetching nodes from DB...');
        const nodes = await getAllNodes();
        console.log(`✅ Loaded ${nodes.length} nodes.`);

        if (nodes.length === 0) {
            console.log('No nodes in DB to sync. Run full sync first.');
            process.exit(0);
        }

        // 2. Extract Pubkeys
        const pubkeys = nodes.map(n => n.pubkey || n.publicKey || '').filter(Boolean);

        // 3. Enrich with On-Chain Data (this includes the new Manager PDA logic)
        console.log('🔗 Fetching On-Chain Data (Managers/Wallets)...');

        // We can use the batch enrich function
        const enrichmentMap = await enrichPNodesWithOnChainData(pubkeys);

        // 4. Merge Data back into nodes
        let updatedCount = 0;
        const nodesToSave = [];

        for (const node of nodes) {
            const key = node.pubkey || node.publicKey;
            if (!key) continue;

            const data = enrichmentMap.get(key);
            if (data) {
                // Update fields
                let changed = false;

                if (data.managerWallet && node.managerWallet !== data.managerWallet) {
                    console.log(`🔹 Linked Node ${key.slice(0, 8)}... -> Buyer ${data.managerWallet.slice(0, 8)}...`);
                    node.managerWallet = data.managerWallet;
                    changed = true;
                }

                if (data.managerPDA && node.managerPDA !== data.managerPDA) {
                    node.managerPDA = data.managerPDA;
                    changed = true;
                }

                if (data.registryPDA && node.registryPDA !== data.registryPDA) {
                    node.registryPDA = data.registryPDA;
                    changed = true;
                }

                if (data.isRegistered !== undefined && node.isRegistered !== data.isRegistered) {
                    node.isRegistered = data.isRegistered;
                    changed = true;
                }

                if (changed) {
                    nodesToSave.push(node);
                    updatedCount++;
                }
            }
        }

        // 5. Save
        if (nodesToSave.length > 0) {
            console.log(`💾 Saving ${nodesToSave.length} updated nodes...`);
            await upsertNodes(nodesToSave);
            console.log('✅ Save complete!');
        } else {
            console.log('✨ No updates found.');
        }

        process.exit(0);

    } catch (error) {
        console.error('Fatal error during sync:', error);
        process.exit(1);
    }
}

main();
