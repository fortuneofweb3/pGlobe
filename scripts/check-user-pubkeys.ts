
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getNodesCollection } from '../lib/server/mongodb-nodes';

const TARGET_PUBKEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Checking ${TARGET_PUBKEYS.length} pubkeys...`);

    // 1. Fetch Credits API
    console.log('Fetching Credits API...');
    let creditsData: any = { pods_credits: [] };
    try {
        const resp = await fetch('https://podcredits.xandeum.network/api/pods-credits');
        creditsData = await resp.json();
    } catch (e) {
        console.error('Failed to fetch credits API:', e);
    }

    const creditsMap = new Map();
    for (const p of creditsData.pods_credits || []) {
        creditsMap.set(p.pod_id, p.credits);
    }

    // 2. Check DB
    console.log('Connecting to DB...');
    const db = await getNodesCollection();
    const nodes = await db.find({ pubkey: { $in: TARGET_PUBKEYS } }).toArray();
    const dbMap = new Map();
    for (const n of nodes) {
        dbMap.set(n.pubkey, n);
    }

    // 3. Report
    console.log('\n=== REPORT ===');
    for (const pubkey of TARGET_PUBKEYS) {
        console.log(`\nPubkey: ${pubkey}`);

        // Credits Info
        const credits = creditsMap.get(pubkey);
        if (credits !== undefined) {
            console.log(`  ✅ Found in Credits API: ${credits} credits`);
        } else {
            console.log(`  Dummy: Not found in Credits API`);
        }

        // DB Info
        const node = dbMap.get(pubkey);
        if (node) {
            console.log(`  ✅ Found in DB:`);
            console.log(`     - IP: ${node.address || 'Unknown'}`);
            console.log(`     - Version: ${node.version || 'Unknown'}`);
            console.log(`     - Status: ${node.status}`);
            console.log(`     - Seen in Gossip: ${node.seenInGossip ?? 'Unknown'}`);
            console.log(`     - Last Seen: ${new Date(node.lastSeen).toISOString()}`);
            console.log(`     - Credits (DB): ${node.credits}`);
            console.log(`     - Location: ${node.location || 'Unknown'}`);
        } else {
            console.log(`  ❌ NOT found in DB`);
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
