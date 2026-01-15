
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function main() {
    const connection = new Connection(HELIUS_RPC, 'confirmed');
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM);

    const match48 = accounts.filter(a => a.account.data.length === 48);

    // Find rare sizes
    const others = accounts.filter(a => a.account.data.length !== 48);

    console.log(`Found ${others.length} non-48-byte accounts.`);

    for (const acc of others) {
        console.log(`\n--- Size ${acc.account.data.length} ---`);
        console.log(`Pubkey: ${acc.pubkey.toBase58()}`);
        // Print as hex
        // If it's huge, print start/end
        const data = acc.account.data;
        if (data.length > 200) {
            console.log(`Start Hex: ${data.slice(0, 100).toString('hex')}`);
            console.log(`...`);
            console.log(`End Hex:   ${data.slice(-50).toString('hex')}`);
        } else {
            console.log(`Hex: ${data.toString('hex')}`);
        }

        // Try to interpret as u64/u32 counters
        try {
            if (data.length >= 8) {
                const firstu64 = data.readBigUInt64LE(0);
                console.log(`First u64 (LE): ${firstu64}`);
            }
            if (data.length >= 4) {
                const firstu32 = data.readUInt32LE(0);
                console.log(`First u32 (LE): ${firstu32}`);
            }
        } catch (e) { }
    }
}

main().catch(console.error);
