
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGETS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3', // User Provided (New typo/variant?)
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3',     // Previous Ghost Node
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ',
    '79xFAcGDxD8vcPy1uW55BajrsucToShRU8JDinVXkXFN'  // Fee Account
];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`\nChecking Accounts...`);
    for (const pubkeyStr of TARGETS) {
        try {
            const pubkey = new PublicKey(pubkeyStr);
            const info = await connection.getAccountInfo(pubkey);

            console.log(`\nKey: ${pubkeyStr}`);
            if (info) {
                console.log(`  ✅ Exists!`);
                console.log(`  Owner: ${info.owner.toBase58()}`);
                console.log(`  Data Size: ${info.data.length} bytes`);
                console.log(`  Lamports: ${info.lamports}`);

                if (info.owner.equals(PROGRAM_ID)) {
                    console.log(`  🎯 Owned by Purchase Program!`);
                }
            } else {
                console.log(`  ❌ Does not exist.`);
            }
        } catch (e) {
            console.log(`\nKey: ${pubkeyStr}`);
            console.log(`  ❌ Invalid Key Format or Error: ${e.message}`);
        }
    }
}

main();
