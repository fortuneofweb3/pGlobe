
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

const TARGET_NODES = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Using RPC: ${DEVNET_RPC}`);
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // 1. Check Gossip first
    console.log('Fetching Gossip Nodes...');
    try {
        const clusterNodes = await connection.getClusterNodes();
        const gossipMap = new Map<string, any>();
        clusterNodes.forEach(n => gossipMap.set(n.pubkey, n));

        console.log(`Found ${clusterNodes.length} nodes in Gossip.`);

        for (const nodePubkeyStr of TARGET_NODES) {
            console.log(`\n=== Investigating Node: ${nodePubkeyStr} ===`);

            // Check Gossip
            const gossipNode = gossipMap.get(nodePubkeyStr);
            if (gossipNode) {
                console.log(`✅ Found in Gossip!`);
                console.log(`   IP: ${gossipNode.gossip || 'No IP in gossip field'}`);
                console.log(`   TPU: ${gossipNode.tpu || 'N/A'}`);
                console.log(`   RPC: ${gossipNode.rpc || 'N/A'}`);
                console.log(`   Version: ${gossipNode.version || 'N/A'}`);
            } else {
                console.log(`❌ Not found in Gossip table.`);
            }

            // Check Node Account
            const nodePubkey = new PublicKey(nodePubkeyStr);
            console.log(`Checking Node Account: ${nodePubkeyStr}`);
            const nodeAccount = await connection.getAccountInfo(nodePubkey);
            if (nodeAccount) {
                console.log(`✅ Node Account Exists!`);
                console.log(`   Owner: ${nodeAccount.owner.toBase58()}`);
                console.log(`   Data Length: ${nodeAccount.data.length}`);

            } else {
                console.log(`❌ Node Account does NOT exist.`);
            }

            // Check Registry PDA
            const [registryAddress] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            console.log(`Checking Registry PDA: ${registryAddress.toBase58()}`);
            const registryAccount = await connection.getAccountInfo(registryAddress);

            if (registryAccount) {
                console.log(`✅ Registry PDA found! Size: ${registryAccount.data.length} bytes`);
                const data = registryAccount.data;

                // Dump as ASCII
                let ascii = '';
                for (let i = 0; i < data.length; i++) {
                    const byte = data[i];
                    if (byte >= 32 && byte <= 126) {
                        ascii += String.fromCharCode(byte);
                    } else {
                        ascii += '.';
                    }
                }
                console.log(`ASCII Dump: ${ascii}`);

                // Try to extract IP-like strings
                const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
                const matches = ascii.match(ipRegex);
                if (matches) {
                    console.log(`🔥 POTENTIAL IPS FOUND IN DATA: ${matches.join(', ')}`);
                }

                // Extract Registrar Wallet at offset 8 (known from previous scripts)
                if (data.length >= 40) {
                    const registrarWallet = new PublicKey(data.slice(8, 40));
                    console.log(`Parsed Registrar Wallet (Offset 8): ${registrarWallet.toBase58()}`);
                }

            } else {
                console.log(`❌ Registry PDA not found.`);
            }
        }

    } catch (e) {
        console.error("Error connecting or fetching gossip:", e);
    }
}

main().catch(console.error);
