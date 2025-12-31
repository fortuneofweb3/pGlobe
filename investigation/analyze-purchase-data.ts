/**
 * Analyze the 16-byte extra data in purchase accounts
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function analyzePurchaseData() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // Get 48-byte purchase accounts
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    console.log(`Found ${accounts.length} purchase accounts\n`);

    // Analyze the 16-byte extra data pattern
    console.log('=== Analyzing Extra Data Structure ===\n');

    // Group by the extra data patterns
    const patterns: Map<string, { count: number, buyers: string[] }> = new Map();

    for (const acc of accounts) {
        const data = acc.account.data;
        const extra = data.slice(32, 48);
        const pattern = extra.toString('hex');

        const buyer = new PublicKey(data.slice(0, 32)).toBase58();

        if (!patterns.has(pattern)) {
            patterns.set(pattern, { count: 0, buyers: [] });
        }
        patterns.get(pattern)!.count++;
        if (patterns.get(pattern)!.buyers.length < 3) {
            patterns.get(pattern)!.buyers.push(buyer);
        }
    }

    console.log('Unique patterns in extra data:');
    for (const [pattern, info] of [...patterns.entries()].sort((a, b) => b[1].count - a[1].count)) {
        const bytes = Buffer.from(pattern, 'hex');
        const byte0 = bytes[0];
        const byte1 = bytes[1];
        console.log(`\n  Pattern: ${pattern}`);
        console.log(`  Count: ${info.count} accounts`);
        console.log(`  Byte 0: ${byte0}, Byte 1: ${byte1}`);
        console.log(`  Sample buyers: ${info.buyers.slice(0, 2).join(', ')}`);
    }

    // Now show all accounts with their breakdown
    console.log('\n\n=== All Purchase Accounts ===\n');

    for (const acc of accounts.slice(0, 20)) {
        const data = acc.account.data;
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        const extra = data.slice(32, 48);

        console.log(`Buyer: ${buyer}`);
        console.log(`  PDA: ${acc.pubkey.toBase58()}`);
        console.log(`  Byte 32-33: [${extra[0]}, ${extra[1]}]`);
        console.log(`  Interpretation: Count=${extra[0]}, Era?=${extra[1]}`);
        console.log('');
    }
}

analyzePurchaseData().catch(console.error);
