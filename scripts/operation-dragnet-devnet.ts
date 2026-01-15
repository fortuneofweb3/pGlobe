
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL'); // Devnet Program ID

const TARGETS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`fetching ALL accounts for Devnet program ${PROGRAM_ID.toBase58()}...`);
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`✅ Fetched ${accounts.length} accounts.`);

    console.log(`\n🔍 STARTING DEVNET DRAGNET SCAN...`);

    // Pre-compute target buffers
    const targetBuffers: { str: string, buf: Buffer }[] = [];
    for (const t of TARGETS) {
        try {
            targetBuffers.push({ str: t, buf: new PublicKey(t).toBuffer() });
        } catch (e) { }
    }

    let foundCount = 0;

    for (const acc of accounts) {
        const data = acc.account.data;

        for (const target of targetBuffers) {
            if (data.includes(target.buf)) {
                console.log(`\n🚨 MATCH FOUND ON DEVNET! 🚨`);
                console.log(`Target: ${target.str}`);
                console.log(`Found inside Account: ${acc.pubkey.toBase58()}`);
                console.log(`Account Data Size: ${data.length} bytes`);
                foundCount++;
            }
        }
    }

    if (foundCount === 0) {
        console.log(`\n❌ DEVNET DRAGNET COMPLETE. NO MATCHES FOUND.`);
    }
}

main();
