
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGETS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    const conn = new Connection(RPC, 'confirmed');
    console.log(`Fetching ALL accounts for program ${PROGRAM_ID.toBase58()}...`);

    const accounts = await conn.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${accounts.length} accounts. Scanning data for target pubkeys...`);

    const targetBuffers = TARGETS.map(t => ({ str: t, buf: new PublicKey(t).toBuffer() }));

    let matches = 0;

    for (const { pubkey, account } of accounts) {
        const data = account.data;

        for (const target of targetBuffers) {
            if (data.includes(target.buf)) {
                console.log(`\n🔥 MATCH FOUND!`);
                console.log(`Target Node: ${target.str}`);
                console.log(`Found inside Account: ${pubkey.toBase58()}`);
                console.log(`Account Size: ${data.length}`);
                console.log(`Account Owner: ${account.owner.toBase58()}`);

                // Print some context around the match
                const idx = data.indexOf(target.buf);
                console.log(`Match Offset: ${idx}`);

                // Hex dump start
                console.log(`Hex Prefix: ${data.slice(0, 16).toString('hex')}`);

                matches++;
            }
        }
    }

    if (matches === 0) {
        console.log(`\nNo matches found in any program account.`);
    } else {
        console.log(`\nTotal matches: ${matches}`);
    }
}

main().catch(console.error);
