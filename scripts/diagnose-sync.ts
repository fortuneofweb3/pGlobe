
import { config } from 'dotenv';
config({ path: '.env.local' });
import { syncRewardsForManager } from '../lib/server/sync-rewards';

async function diagnose() {
    const wallet = 'CYxrrpDtELXmP5u5CBSA2KWaWzov2VmF5aRFJdGRLuVy';
    console.log(`Starting diagnostic for wallet: ${wallet}`);

    try {
        const result = await syncRewardsForManager(wallet);
        console.log('Sync Result:', JSON.stringify(result, null, 2));

        // Let's also manually check the count in DB here
        const { getDb } = await import('../lib/server/mongodb-nodes');
        const db = await getDb();
        const nodes = await db.collection('nodes').find({
            $or: [{ managerWallet: wallet }, { registrarWallet: wallet }]
        }).toArray();
        console.log(`Final DB Check: Found ${nodes.length} nodes. Vesting stakes:`, nodes.map(n => n.vestingStake));

    } catch (err) {
        console.error('Diagnostic failed:', err);
    }
}

diagnose();
