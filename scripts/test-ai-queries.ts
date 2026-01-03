
import { getManagerStats, getTopManagers, getNetworkStats, getNetworkTrend, getEraStats, getCurrentEra, getNodeStats, getRecentActivity } from '../lib/ai/queries';
import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    console.log('🧪 Testing AI Data Queries...\n');

    try {
        // Ensure DB connection
        await getDb();

        // 1. Test Network Stats
        console.log('--- Network Stats (All) ---');
        const netStats = await getNetworkStats('all');
        console.log(JSON.stringify(netStats, null, 2));

        console.log('\n--- Network Stats (Mainnet) ---');
        const mainnetStats = await getNetworkStats('mainnet');
        console.log(`Mainnet Nodes: ${mainnetStats.totalNodes}, Online: ${mainnetStats.onlineNodes}`);

        // 2. Test Trend
        console.log('\n--- Network Trend (7 Days) ---');
        const trend = await getNetworkTrend(7);
        console.log(JSON.stringify(trend.slice(0, 3), null, 2), '... (truncated)');

        // 3. Test Top Managers
        console.log('\n--- Top Managers ---');
        const topManagers = await getTopManagers(3);
        console.log(JSON.stringify(topManagers, null, 2));

        // 4. Test Specific Manager (using first one found)
        if (topManagers.length > 0) {
            const wallet = topManagers[0].wallet;
            console.log(`\n--- Stats for Manager ${wallet} ---`);
            const mgrStats = await getManagerStats(wallet);
            console.log(JSON.stringify(mgrStats, null, 2));
        }

        // 5. Test Eras
        console.log('\n--- Era Stats ---');
        const eras = await getEraStats();
        console.log(`Found ${eras.length} eras`);
        console.log(JSON.stringify(eras.slice(0, 2), null, 2), '... (truncated)');

        console.log('\n--- Current Era ---');
        const curEra = await getCurrentEra();
        console.log(`Current Era: ${curEra.name} (${curEra.totalNodes} nodes)`);

        // 6. Test Recent Activity
        console.log('\n--- Recent Activity ---');
        const logs = await getRecentActivity(3);
        console.log(`Found ${logs.length} logs`);
        if (logs.length > 0) {
            console.log(`Latest: ${logs[0].message} (${logs[0].type})`);
        }

        // 7. Test Specific Node (using a known pubkey from previous data if available, or just skip if empty)
        // We'll use the first node from top managers if available
        let testPubkey = '';
        if (topManagers.length > 0) {
            // We'll just fetch managers again to get a node pubkey via topNodes
            const mgr = await getManagerStats(topManagers[0].wallet);
            if (mgr.topNodes.length > 0) testPubkey = mgr.topNodes[0].pubkey;
        }

        if (testPubkey) {
            console.log(`\n--- Stats for Node ${testPubkey} ---`);
            const node = await getNodeStats(testPubkey);
            if (node) {
                console.log(`FOUND: Version ${node.version}, Status ${node.status}`);
            } else {
                console.log('Node not found (unexpected)');
            }
        }

        console.log('\n✅ All tests completed');
        process.exit(0);
    } catch (err: any) {
        console.error('\n❌ Test failed:', err);
        process.exit(1);
    }
}

main();
