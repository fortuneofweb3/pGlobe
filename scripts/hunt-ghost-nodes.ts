
import { Connection, PublicKey } from '@solana/web3.js';

const TARGET_KEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

const NETWORKS = [
    { name: 'Solana Devnet', url: 'https://api.devnet.solana.com' },
    { name: 'Solana Testnet', url: 'https://api.testnet.solana.com' },
    { name: 'Solana Mainnet (Gossip)', url: 'https://api.mainnet-beta.solana.com', gossip: true }
];

async function main() {
    console.log(`🔎 hunting for ghosts...`);

    for (const net of NETWORKS) {
        console.log(`\n--- Checking ${net.name} ---`);
        try {
            const conn = new Connection(net.url, 'confirmed');

            // 1. Account Check
            if (!net.gossip) {
                for (const key of TARGET_KEYS) {
                    try {
                        const pk = new PublicKey(key);
                        const info = await conn.getAccountInfo(pk);
                        if (info) {
                            console.log(`  ✅ FOUND ACCOUNT: ${key}`);
                            console.log(`     Owner: ${info.owner.toBase58()}`);
                        } else {
                            // console.log(`     (No Account)`);
                        }
                    } catch (e) {
                        // invalid key
                    }
                }
            } else {
                // 2. Gossip Check (Mainnet)
                console.log(`  Fetching Cluster Nodes (Gossip Table)...`);
                const nodes = await conn.getClusterNodes();
                console.log(`  Scanned ${nodes.length} active nodes.`);

                const found = nodes.filter(n => TARGET_KEYS.includes(n.pubkey));
                if (found.length > 0) {
                    found.forEach(n => {
                        console.log(`  ✅ FOUND IN GOSSIP: ${n.pubkey}`);
                        console.log(`     IP: ${n.gossip}`);
                        console.log(`     Version: ${n.version}`);
                    });
                } else {
                    console.log(`  ❌ None found in Gossip Table.`);
                }

                // Also check accounts on Mainnet just in case (already done, but good strictly)
                // Skipping to avoid redundancy with previous script, focusing on Gossip here.
            }

        } catch (e: any) {
            console.log(`  ⚠️ Connection Failed: ${e.message}`);
        }
    }
}

main();
