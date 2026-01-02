
import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { getHistoricalSnapshots } from '../lib/server/mongodb-history';
import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    try {
        console.log('Connecting to DB...');
        await getDb();
        console.log('Connected.');

        const now = Date.now();
        const startTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days

        console.log('\n--- Testing "all" network ---');
        const allSnapshots = await getHistoricalSnapshots(startTime, now, 5, 'all');
        console.log(`Fetched ${allSnapshots.length} snapshots for "all"`);
        if (allSnapshots.length > 0) {
            console.log('Sample snapshot total nodes:', allSnapshots[0].totalNodes);
        }

        console.log('\n--- Testing "devnet" network ---');
        const devnetSnapshots = await getHistoricalSnapshots(startTime, now, 5, 'devnet');
        console.log(`Fetched ${devnetSnapshots.length} snapshots for "devnet"`);
        if (devnetSnapshots.length > 0) {
            console.log('Sample devnet snapshot total nodes:', devnetSnapshots[0].totalNodes);
        }

        console.log('\n--- Testing "mainnet" network ---');
        const mainnetSnapshots = await getHistoricalSnapshots(startTime, now, 5, 'mainnet');
        console.log(`Fetched ${mainnetSnapshots.length} snapshots for "mainnet"`);
        if (mainnetSnapshots.length > 0) {
            console.log('Sample mainnet snapshot total nodes:', mainnetSnapshots[0].totalNodes);
        } else {
            console.log('No mainnet snapshots found (expected if no history yet)');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
