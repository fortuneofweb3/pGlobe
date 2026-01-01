
import dotenv from 'dotenv';
import path from 'path';
import { fetchAllNodes } from '../lib/server/sync-nodes';
import { getAllNodes } from '../lib/server/mongodb-nodes';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function compare() {
    console.log('--- STARTING DETAILED COMPARISON ---');

    try {
        // 1. Fetch from Gossip
        console.log('Fetching from gossip...');
        const gossipNodesMap = await fetchAllNodes();
        const gossipNodes = Array.from(gossipNodesMap.values());
        console.log(`Unique Gossip nodes found: ${gossipNodes.length}`);

        // 2. Fetch from DB
        console.log('Fetching from database...');
        const dbNodes = await getAllNodes();
        console.log(`Database nodes found: ${dbNodes.length}`);

        // 3. Analysis
        const gossipPubkeys = gossipNodes.map(n => n.pubkey);
        const dbPubkeys = dbNodes.map(n => n.pubkey);

        const onlyInGossip = gossipPubkeys.filter(pk => !dbPubkeys.includes(pk));
        const onlyInDb = dbPubkeys.filter(pk => !gossipPubkeys.includes(pk));

        const onlineInDb = dbNodes.filter(n => n.status === 'online').length;

        console.log('\n--- OVERALL COUNTS ---');
        console.log(`Gossip (Online/Syncing): ${gossipNodes.length}`);
        console.log(`DB Total: ${dbNodes.length}`);
        console.log(`DB Online: ${onlineInDb}`);

        console.log(`\n--- VERSION DISTRIBUTION (Gossip) ---`);
        const gossipVersions: Record<string, number> = {};
        gossipNodes.forEach(n => {
            const v = n.version || 'unknown';
            gossipVersions[v] = (gossipVersions[v] || 0) + 1;
        });
        Object.entries(gossipVersions).sort().forEach(([v, count]) => {
            console.log(` - ${v}: ${count}`);
        });

        console.log(`\n--- PUBLIC NODE CHECK (v0.8.0) ---`);
        const public080 = gossipNodes.filter(n => n.version === '0.8.0' && n.isPublic);
        console.log(`Public v0.8.0 nodes in Gossip: ${public080.length}`);
        if (public080.length > 0) {
            console.log('Sample address:', public080[0].address);
        }

        console.log(`\n--- DISCREPANCIES ---`);
        console.log(`Nodes in Gossip but NOT in DB: ${onlyInGossip.length}`);
        if (onlyInGossip.length > 0) {
            console.log('Sample missing in DB:', onlyInGossip.slice(0, 3));
        }

        const ghostOnline = dbNodes.filter(n => n.status === 'online' && !gossipNodesMap.has(n.pubkey || ''));
        console.log(`Ghost Online (DB says online, but not in gossip): ${ghostOnline.length}`);
        if (ghostOnline.length > 0) {
            console.log('Sample ghost nodes:', ghostOnline.slice(0, 3).map(n => n.pubkey));
        }

        // Deduplication check: group by IP
        const byAddress = new Map<string, string[]>();
        gossipNodes.forEach(n => {
            if (n.address) {
                if (!byAddress.has(n.address)) byAddress.set(n.address, []);
                byAddress.get(n.address)!.push(n.pubkey);
            }
        });

        const duplicateIPs = Array.from(byAddress.entries()).filter(([addr, pks]) => pks.length > 1);
        console.log(`\nDuplicate IPs (One IP, multiple Pubkeys): ${duplicateIPs.length}`);
        if (duplicateIPs.length > 0) {
            console.log('Sample duplicates:', duplicateIPs.slice(0, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error during comparison:', error);
        process.exit(1);
    }
}

compare();
