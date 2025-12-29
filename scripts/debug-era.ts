
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '../lib/server/mongodb-nodes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const RPC_URL = 'https://api.devnet.xandeum.com:8899'; // Devnet for registry

async function debugEra() {
    const connection = new Connection(RPC_URL, 'confirmed');
    // Using a known node ID from logs (managed by Bx1aH...)
    const nodePubkeyStr = 'GCoCP7CLvVivuWUH1sSA9vMi9jjaJcXpMwVozMVA6yBg';
    const nodePubkey = new PublicKey(nodePubkeyStr);

    console.log(`Debugging Era for Node: ${nodePubkeyStr}`);

    // Derive Registry PDA
    const [registryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), nodePubkey.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`Registry PDA: ${registryPDA.toBase58()}`);

    const info = await connection.getAccountInfo(registryPDA);
    if (!info) {
        console.log('Registry Account NOT FOUND');
        return;
    }

    console.log(`Registry Data Length: ${info.data.length} bytes`);

    // Dump first 128 bytes in hex to inspect layout
    const hex = info.data.slice(0, 128).toString('hex');
    // split into lines of 16 bytes for readability
    for (let i = 0; i < hex.length; i += 32) {
        // i is nibbles (2 per byte). i/2 is byte offset.
        console.log(`Offset ${i / 2}: ${hex.slice(i, i + 32)}`);
    }

    // Explicit check of offset 40
    if (info.data.length >= 48) {
        const purchasePriceLamports = Number(info.data.readBigUInt64LE(40));
        console.log(`Offset 40 (u64 LE): ${purchasePriceLamports}`);

        if (info.data.length >= 82) {
            const maybePrice = Number(info.data.readBigUInt64LE(74));
            console.log(`Offset 74 (u64 LE): ${maybePrice} (${maybePrice / 1e9} SOL)`);
        }
    }

    process.exit(0);
}

debugEra();
