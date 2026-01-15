
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const TARGET_KEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`\n--- Checking Transaction History ---`);
    for (const keyStr of TARGET_KEYS) {
        try {
            const pk = new PublicKey(keyStr);
            console.log(`\nChecking: ${keyStr}`);

            // Get last 1 signature just to see if ANY exist
            const signatures = await connection.getSignaturesForAddress(pk, { limit: 1 });

            if (signatures.length > 0) {
                console.log(`  ✅ FOUND HISTORY! (${signatures.length}+ txs)`);
                console.log(`  Last Tx: ${signatures[0].signature}`);
                console.log(`  Time: ${signatures[0].blockTime ? new Date(signatures[0].blockTime * 1000).toISOString() : 'Unknown'}`);
            } else {
                console.log(`  ❌ No transaction history found (Never active on Mainnet).`);
            }
        } catch (e: any) {
            console.log(`  ⚠️ Error: ${e.message}`);
        }
    }
}

main();
