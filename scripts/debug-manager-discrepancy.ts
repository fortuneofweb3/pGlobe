
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

import { Connection, PublicKey } from '@solana/web3.js';
import { getManagerPurchaseStats, discoverManagerWallet } from '../lib/server/manager-discovery';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function main() {
    const targetPrefix = 'BeXhN2';
    const targetSuffix = '3EJF';

    console.log(`Searching for manager with prefix ${targetPrefix} and suffix ${targetSuffix}...`);

    // 1. Get all stats and find the wallet
    const stats = await getManagerPurchaseStats();
    let targetWallet = '';
    let purchaseCount = 0;

    for (const [wallet, count] of stats.entries()) {
        if (wallet.startsWith(targetPrefix) && wallet.endsWith(targetSuffix)) {
            targetWallet = wallet;
            purchaseCount = count;
            break;
        }
    }

    if (!targetWallet) {
        console.error('Manager not found in purchase stats!');
        return;
    }

    console.log(`FOUND Manager: ${targetWallet}`);
    console.log(`Purchased Licenses (Mainnet): ${purchaseCount}`);

    // 2. Find all nodes associated with this manager in DB
    const collection = await getNodesCollection();
    const nodes = await collection.find({
        $or: [
            { managerWallet: targetWallet },
            { registrarWallet: targetWallet }
        ]
    }).toArray();

    console.log(`\nFound ${nodes.length} nodes in DB linked to this manager:`);
    const uniqueIPs = new Set();
    const uniquePubkeys = new Set();

    nodes.forEach(n => {
        const net = n.network || 'unknown';
        console.log(`- Node ${n.publicKey} (${net}) | Status: ${n.status} | IP: ${n.ipAddress}`);
        if (n.ipAddress) uniqueIPs.add(n.ipAddress);
        if (n.publicKey) uniquePubkeys.add(n.publicKey);
    });

    console.log(`\nUnique Pubkeys: ${uniquePubkeys.size}`);
    console.log(`Unique IPs: ${uniqueIPs.size}`);

    // 3. Check for specific "Ghost" nodes or mis-attributed ones
    // (This part is manual analysis of the output above)

    process.exit(0);
}

main().catch(console.error);
