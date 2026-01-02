
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function main() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log('Fetching accounts...');

    // Get ALL accounts
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM);

    console.log(`Found ${accounts.length} total accounts.`);

    // Group by size
    const sizes = new Map<number, number>();
    accounts.forEach(a => {
        const size = a.account.data.length;
        sizes.set(size, (sizes.get(size) || 0) + 1);
    });

    console.log('Account sizes distribution:', Object.fromEntries(sizes));

    // If there are other sizes, inspect them
    for (const [size, count] of sizes.entries()) {
        if (size === 48) continue;

        console.log(`\nInspecting size ${size} (count: ${count}):`);
        const sample = accounts.find(a => a.account.data.length === size);
        if (sample) {
            console.log(`Sample Data (hex): ${sample.account.data.toString('hex')}`);
        }
    }
    for (let i = 0; i < Math.min(5, accounts.length); i++) {
        const { pubkey, account } = accounts[i];
        console.log(`\nAccount: ${pubkey.toBase58()}`);
        console.log(`Owner: ${account.owner.toBase58()}`);
        console.log(`Data (hex): ${account.data.toString('hex')}`);

        // Try to parse typical layout: [Discriminator (8)] [Wallet (32)] [Count (8)]? 
        // Or [Wallet (32)] ...

        const data = account.data;
        const wallet = new PublicKey(data.slice(0, 32));
        console.log(`- Bytes 0-32 (Wallet?): ${wallet.toBase58()}`);

        const remaining = data.slice(32);
        console.log(`- Remaining bytes (hex): ${remaining.toString('hex')}`);

        // Try reading remaining as u64/i64
        try {
            const num = remaining.readBigUInt64LE(0);
            console.log(`- Bytes 32-40 (u64): ${num}`);
        } catch (e) { }

        try {
            // Maybe offset 8? (Discriminator first?)
            // Common Anchor pattern: 8 bytes discriminator
            if (data.length >= 40) {
                const potentialWallet = new PublicKey(data.slice(8, 40));
                console.log(`- Bytes 8-40 (Wallet with discriminator?): ${potentialWallet.toBase58()}`);
            }
        } catch (e) { }
    }
}

main();
