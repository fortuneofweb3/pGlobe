
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

// Known sizes for heuristics
const SIZES = {
    1040: 'Registry PDA (Node)',
    64: 'Manager/Stats?',
    48: 'Config/Fee?'
};

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`fetching ALL accounts for program ${PROGRAM_ID.toBase58()}...`);
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`✅ Fetched ${accounts.length} accounts.\n`);

    const summary: Record<string, number> = {};
    const details: any[] = [];

    for (const acc of accounts) {
        const size = acc.account.data.length;
        const typeObj = SIZES[size] || `Unknown Size (${size})`;
        summary[typeObj] = (summary[typeObj] || 0) + 1;

        // Try to decode some common patterns (like first 32 bytes being a pubkey)
        let firstKey = '';
        if (size >= 32) {
            try {
                firstKey = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
            } catch (e) { }
        }

        details.push({
            pubkey: acc.pubkey.toBase58(),
            size,
            type: typeObj,
            firstKey
        });
    }

    console.log('--- Account Summary ---');
    console.table(summary);

    console.log('\n--- Sample Accounts (First 10) ---');
    console.table(details.slice(0, 10));

    // If there are Registry PDAs, show one to see if the "First Key" looks like a Node ID
    const sampleRegistry = details.find(d => d.size === 1040);
    if (sampleRegistry) {
        console.log(`\n--- Deep Look at a Registry PDA (${sampleRegistry.pubkey}) ---`);
        console.log(`First 32 bytes (Node Pubkey?): ${sampleRegistry.firstKey}`);
    }
}

main();
