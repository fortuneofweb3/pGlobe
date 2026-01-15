
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGETS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3', // Typo variant
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`fetching ALL accounts for program ${PROGRAM_ID.toBase58()}...`);
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`✅ Fetched ${accounts.length} accounts.`);

    console.log(`\n🔍 STARTING DRAGNET SCAN...`);

    // Pre-compute target buffers
    const targetBuffers: { str: string, buf: Buffer }[] = [];

    for (const t of TARGETS) {
        try {
            targetBuffers.push({
                str: t,
                buf: new PublicKey(t).toBuffer()
            });
        } catch (e) {
            console.log(`⚠️ Skipping invalid target key: ${t}`);
        }
    }

    let foundCount = 0;

    for (const acc of accounts) {
        const data = acc.account.data;

        for (const target of targetBuffers) {
            // Check if buffer includes target key
            if (data.includes(target.buf)) {
                console.log(`\n🚨 MATCH FOUND! 🚨`);
                console.log(`Target: ${target.str}`);
                console.log(`Found inside Account: ${acc.pubkey.toBase58()}`);
                console.log(`Account Data Size: ${data.length} bytes`);
                console.log(`Account Lamports: ${acc.account.lamports}`);

                // Print surrounding context?
                const idx = data.indexOf(target.buf);
                console.log(`Offset: ${idx}`);

                foundCount++;
            }
        }
    }

    if (foundCount === 0) {
        console.log(`\n❌ DRAGNET COMPLETE. NO MATCHES FOUND.`);
        console.log(`Checked ${accounts.length} accounts against ${TARGETS.length} targets.`);
    } else {
        console.log(`\n✅ DRAGNET COMPLETE. Found ${foundCount} matches.`);
    }
}

main();
