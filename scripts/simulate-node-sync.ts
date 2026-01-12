
import { syncNodes } from '../lib/server/sync-nodes';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function simulate() {
    console.log('Starting simulated node sync...');
    try {
        const result = await syncNodes();
        console.log('Sync Result:', JSON.stringify(result, null, 2));

        const { getDb } = await import('../lib/server/mongodb-nodes');
        const db = await getDb();
        const nodes = await db.collection('nodes').find({
            managerWallet: 'CYxrrpDtELXmP5u5CBSA2KWaWzov2VmF5aRFJdGRLuVy'
        }).toArray();
        console.log(`Post-Sync Check: Found ${nodes.length} nodes. Vesting stakes:`, nodes.map(n => n.vestingStake));
    } catch (err) {
        console.error('Simulation failed:', err);
    }
}

simulate();
