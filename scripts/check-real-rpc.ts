
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = 'https://rpc3.pchednode.com/rpc'; // Potential Mainnet
const TARGETS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Connecting to potential Mainnet RPC: ${RPC}`);
    const connection = new Connection(RPC, 'confirmed');

    try {
        const version = await connection.getVersion();
        console.log(`RPC Version:`, version);
    } catch (e) {
        console.log(`RPC Connection Failed:`, e.message);
        return; // Exit if down
    }

    for (const pubkeyStr of TARGETS) {
        console.log(`\nChecking ${pubkeyStr}...`);
        const pubkey = new PublicKey(pubkeyStr);
        const info = await connection.getAccountInfo(pubkey);
        if (info) {
            console.log(`✅ FOUND on Real RPC!`);
            console.log(`   Owner: ${info.owner.toBase58()}`);
            console.log(`   Data Len: ${info.data.length}`);
            console.log(`   Lamports:${info.lamports}`);
        } else {
            console.log(`❌ Not found on Real RPC.`);
        }
    }
}

main();
