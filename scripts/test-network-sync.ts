/**
 * Quick test: Run a sync cycle to verify network enrichment is working
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { syncNodes } from '../lib/server/sync-nodes';

async function main() {
    console.log('Starting sync with network enrichment...\n');

    const result = await syncNodes();

    console.log('\n=== SYNC RESULT ===');
    console.log(result);

    // Quick check of the results
    const { getNodesCollection } = await import('../lib/server/mongodb-nodes');
    const db = await getNodesCollection();

    const networkCounts = await db.aggregate([
        { $group: { _id: '$network', count: { $sum: 1 } } }
    ]).toArray();

    console.log('\n=== NETWORK DISTRIBUTION ===');
    networkCounts.forEach(n => console.log(`  ${n._id || 'undefined'}: ${n.count}`));

    // Sample node with network field
    const sampleWithNetwork = await db.findOne({ network: { $exists: true } });
    if (sampleWithNetwork) {
        console.log('\n=== SAMPLE NODE WITH NETWORK ===');
        console.log(`  Pubkey: ${sampleWithNetwork.pubkey?.slice(0, 12)}...`);
        console.log(`  Network: ${sampleWithNetwork.network}`);
        console.log(`  Mainnet Credits: ${sampleWithNetwork.mainnetCredits}`);
        console.log(`  Devnet Credits: ${sampleWithNetwork.devnetCredits}`);
        console.log(`  Credits (primary): ${sampleWithNetwork.credits}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
