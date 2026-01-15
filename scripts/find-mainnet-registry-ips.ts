
import { Connection, PublicKey } from '@solana/web3.js';
import * as net from 'net';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGET_NODES = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Using RPC: ${MAINNET_RPC}`);
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // 1. Check Gossip first (just in case)
    console.log('Fetching Gossip Nodes...');
    const clusterNodes = await connection.getClusterNodes();
    const gossipMap = new Map<string, any>();
    clusterNodes.forEach(n => gossipMap.set(n.pubkey, n));

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
            console.log(`   Lamports: ${nodeAccount.lamports / 1000000000} SOL`);

            // Is it a Vote Account?
            if (nodeAccount.owner.toBase58() === 'Vote111111111111111111111111111111111111111') {
                console.log(`   Type: VOTE ACCOUNT`);
            }
        } else {
            console.log(`❌ Node Account does NOT exist (System Account with 0 lamports or invalid).`);
        }

        // Check Registry PDA
        const [registryAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePubkey.toBuffer()],
            MAINNET_PROGRAM
        );

        console.log(`Checking Registry PDA: ${registryAddress.toBase58()}`);
        const accountInfo = await connection.getAccountInfo(registryAddress);

        if (accountInfo) {
            console.log(`✅ Registry PDA found! Size: ${accountInfo.data.length} bytes`);
            const data = accountInfo.data;

            // Dump as ASCII to find potential strings (IPs/Hostnames)
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
            } else {
                console.log(`No obvious IP strings found in data.`);
            }

            // Hex dump for manual inspection
            console.log(`Hex Dump (first 256 bytes):`);
            console.log(data.slice(0, 256).toString('hex'));

        } else {
            console.log(`❌ Registry PDA not found.`);
        }
    }
}

main().catch(console.error);
