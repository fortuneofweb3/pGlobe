
import { getNodesCollection, getDb } from '../lib/server/mongodb-nodes';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🧹 Cleaning up On-Chain Synced Nodes...');

    try {
        const db = await getDb();
        const collection = await getNodesCollection();

        // Delete nodes that were explicitly sourced from on-chain sync
        // The previous sync script added `_source: 'onchain'` to these nodes
        const result = await collection.deleteMany({ _source: 'onchain' });

        console.log(`✅ Deleted ${result.deletedCount} nodes sourced from on-chain sync.`);

        // Also cleanup any nodes that are "offline" and "devnet" but have NO address/ip
        // These are likely ghost nodes from the on-chain index
        // We keep nodes that have an address (gossip nodes)
        const ghostResult = await collection.deleteMany({
            network: 'devnet',
            address: { $exists: false },
            _source: { $exists: false } // Only if they don't have a source (just in case)
        });

        if (ghostResult.deletedCount > 0) {
            console.log(`👻 Deleted ${ghostResult.deletedCount} ghost nodes (no IP address).`);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    }
}

main();
