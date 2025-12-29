import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function inspectPurchases() {
    const conn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('Fetching Mainnet Purchase Accounts...');
    const accounts = await conn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [
            { dataSize: 48 } // We know they are 48 bytes from previous work
        ]
    });

    console.log(`Found ${accounts.length} purchase accounts.`);

    // Inspect the first 5 accounts
    console.log('\n--- Account Layout Inspection ---');
    for (let i = 0; i < 5 && i < accounts.length; i++) {
        const acc = accounts[i]; // No `account` property wrapper usually for getProgramAccounts unless configured
        // Actually getProgramAccounts returns { pubkey, account: { ... } }

        const data = acc.account.data;
        console.log(`\nAccount: ${acc.pubkey.toBase58()}`);
        console.log(`Data Length: ${data.length}`);

        // Bytes 0-32: Buyer Wallet (usually)
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        console.log(`Bytes 0-32 (Buyer?): ${buyer}`);

        // Bytes 32-48: Remaining 16 bytes. 
        // Is Node pubkey here? Node pubkey is 32 bytes, so it CANNOT fit in 16 bytes.
        console.log(`Bytes 32-48 (Hex): ${data.slice(32, 48).toString('hex')}`);
    }

    if (accounts.length > 0 && accounts[0].account.data.length === 48) {
        console.log(`\n[!] CRITICAL FINDING: Account size is 48 bytes.`);
        console.log(`    - 32 bytes for Owner/Buyer`);
        console.log(`    - 16 bytes remaining.`);
        console.log(`    - A Solana Pubkey (pNode ID) requires 32 bytes.`);
        console.log(`    -> THEREFORE: The Mainnet Purchase Account DOES NOT contain the pNode Pubkey.`);
    }

    process.exit(0);
}

inspectPurchases();
