
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function inspectLarge() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // Fetch 80-byte account
    console.log('Fetching 80-byte account...');
    const acc80 = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 80 }]
    });
    for (const acc of acc80) {
        console.log(`\n[80 bytes] ${acc.pubkey.toBase58()}`);
        console.log(`   Data (Hex): ${acc.account.data.toString('hex')}`);

        // Try decode as 2x PublicKey + 16 bytes
        if (acc.account.data.length >= 64) {
            console.log(`   Key@0: ${new PublicKey(acc.account.data.slice(0, 32)).toBase58()}`);
            console.log(`   Key@32: ${new PublicKey(acc.account.data.slice(32, 64)).toBase58()}`);
            console.log(`   Remaining: ${acc.account.data.slice(64).toString('hex')}`);
        }
    }

    // Fetch 1536-byte account
    console.log('\nFetching 1536-byte account...');
    const acc1536 = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 1536 }]
    });
    for (const acc of acc1536) {
        console.log(`\n[1536 bytes] ${acc.pubkey.toBase58()}`);
        console.log(`   First 128 bytes: ${acc.account.data.slice(0, 128).toString('hex')}`);

        // If it's an index, it might contain 32-byte pubkeys
        console.log('\n   Attempting to decode as pubkey array:');
        const keys: string[] = [];
        for (let i = 0; i < acc.account.data.length; i += 32) {
            if (i + 32 > acc.account.data.length) break;
            try {
                const key = new PublicKey(acc.account.data.slice(i, i + 32));
                if (key.toBase58() !== '11111111111111111111111111111111') {
                    keys.push(key.toBase58());
                }
            } catch { }
        }
        console.log(`   Found ${keys.length} non-zero pubkeys.`);
        if (keys.length > 0 && keys.length < 10) {
            keys.forEach((k, i) => console.log(`   Key[${i}]: ${k}`));
        } else if (keys.length > 0) {
            console.log(`   First 5: ${keys.slice(0, 5).join(', ')}`);
            console.log(`   Last 5: ${keys.slice(-5).join(', ')}`);
        }
    }
}

inspectLarge().catch(console.error);
