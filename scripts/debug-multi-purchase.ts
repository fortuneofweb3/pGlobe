
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function main() {
    console.log('Checking for multiple purchase accounts for 1kbN95... and 5v22...');
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    const targets = [
        '1kbN95whs6ANM4DCpM65BugzWYczsSvrEKnCbAbJCsT',
        '5v22cdd6wwYA6F2VLsjt9pW9heWx6gcqnyRYmXmzqA84'
    ];

    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    console.log(`Fetched ${accounts.length} total purchase accounts.`);

    for (const target of targets) {
        console.log(`\nScanning for ${target}...`);
        const matches = accounts.filter(acc => {
            const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
            return wallet === target;
        });

        if (matches.length > 0) {
            console.log(`Found ${matches.length} accounts:`);
            let total = 0;
            matches.forEach((m, i) => {
                const count = m.account.data.readUInt8(32);
                console.log(`  Account ${i + 1}: ${m.pubkey.toBase58()} -> Count: ${count}`);
                total += count;
            });
            console.log(`Total Purchased: ${total}`);
        } else {
            console.log('No accounts found.');
        }
    }
}

main().catch(console.error);
