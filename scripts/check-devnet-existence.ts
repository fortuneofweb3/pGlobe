
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const CONNECTION = new Connection(DEVNET_RPC, 'confirmed');

const GHOST_NODES = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Checking ${GHOST_NODES.length} ghost nodes on DEVNET...`);

    for (const pubkeyStr of GHOST_NODES) {
        console.log(`\n==================================================`);
        console.log(`Target: ${pubkeyStr}`);
        const pubkey = new PublicKey(pubkeyStr);

        // 1. Check Account Info
        try {
            const info = await CONNECTION.getAccountInfo(pubkey);
            if (info) {
                console.log(`✅ [DEVNET] Account Exists!`);
                console.log(`   - Owner: ${info.owner.toBase58()}`);
                console.log(`   - Balance: ${info.lamports / 1e9} SOL`);
            } else {
                console.log(`❌ [DEVNET] Account does not exist`);
            }
        } catch (e: any) {
            console.log(`❌ Error: ${e.message}`);
        }

        // 2. Check History
        try {
            const signatures = await CONNECTION.getSignaturesForAddress(pubkey, { limit: 5 });
            if (signatures.length > 0) {
                console.log(`✅ [DEVNET] Found ${signatures.length} transactions.`);
            } else {
                console.log(`❌ [DEVNET] No transactions found.`);
            }
        } catch (e) { }
    }
}

main().catch(console.error);
