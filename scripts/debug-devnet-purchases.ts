
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function main() {
    console.log('Checking for Devnet purchase accounts...');
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    const targets = [
        '1kbN95whs6ANM4DCpM65BugzWYczsSvrEKnCbAbJCsT',
        '5v22cdd6wwYA6F2VLsjt9pW9heWx6gcqnyRYmXmzqA84'
    ];

    try {
        const accounts = await connection.getProgramAccounts(DEVNET_PROGRAM, {
            filters: [{ dataSize: 48 }]
        });

        console.log(`Fetched ${accounts.length} total Devnet purchase accounts.`);

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
                console.log(`Total Devnet Purchased: ${total}`);
            } else {
                console.log('No Devnet accounts found.');
            }
        }
    } catch (e) {
        console.error('Error fetching Devnet accounts:', e);
    }
}

main().catch(console.error);
