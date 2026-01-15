
import { Connection } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function main() {
    try {
        console.log(`Connecting to ${DEVNET_RPC}...`);
        const connection = new Connection(DEVNET_RPC, 'confirmed');

        console.log('Fetching Cluster Nodes (Gossip)...');
        const nodes = await connection.getClusterNodes();

        console.log(`Found ${nodes.length} nodes in Gossip.`);

        // Check for duplicate IPs
        const ipCounts: Record<string, number> = {};
        const ipToPubkeys: Record<string, string[]> = {};

        nodes.forEach(n => {
            if (!n.gossip) return; // Skip if no gossip address
            const ip = n.gossip.split(':')[0];

            ipCounts[ip] = (ipCounts[ip] || 0) + 1;

            if (!ipToPubkeys[ip]) ipToPubkeys[ip] = [];
            ipToPubkeys[ip].push(n.pubkey);
        });

        const duplicates = Object.entries(ipCounts).filter(([ip, count]) => count > 1);

        console.log(`\nIPs with >1 Pubkey: ${duplicates.length}`);

        duplicates.slice(0, 10).forEach(([ip, count]) => {
            console.log(`- ${ip}: ${count} nodes`);
            console.log(`  Pubkeys: ${ipToPubkeys[ip].join(', ')}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
