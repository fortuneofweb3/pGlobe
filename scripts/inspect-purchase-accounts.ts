
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function main() {
    console.log(`Connecting to ${HELIUS_RPC}...`);
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    console.log(`Fetching 48-byte accounts for program ${MAINNET_PROGRAM.toBase58()}...`);
    // fetch only a few
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    console.log(`Found ${accounts.length} accounts of size 48.`);

    // Inspect first 5
    const sample = accounts.slice(0, 5);

    for (const acc of sample) {
        const data = acc.account.data;
        console.log(`\nAccount Pubkey: ${acc.pubkey.toBase58()}`);
        console.log(`Raw Data (Hex): ${data.toString('hex')}`);

        // Decode per current assumption
        const walletBytes = data.slice(0, 32);
        const wallet = new PublicKey(walletBytes).toBase58();
        const byte32 = data[32];
        const byte33 = data[33];
        const byte34 = data[34];

        console.log(`Decoded:`);
        console.log(`  Wallet (Offset 0-32): ${wallet}`);
        console.log(`  Byte 32 (Count?): ${byte32}`);
        console.log(`  Byte 33: ${byte33}`);
        console.log(`  Byte 34: ${byte34}`);

        // Check if the rest is zero
        const rest = data.slice(33);
        const isZero = rest.every(b => b === 0);
        console.log(`  Rest (33-47) is all zeros? ${isZero}`);
    }
}

main().catch(console.error);
