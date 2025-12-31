/**
 * Script to inspect the actual on-chain registry data structure
 * to understand how era should be properly identified
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function inspectEraData() {
    // Connect to MongoDB to get registered nodes with different era labels
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db('pGlobe');

    // Get sample nodes from each era category
    const samples: Record<string, string[]> = {
        'Deep South Era': [],
        'South Era': [],
        'null': [],
    };

    const deepSouth = await db.collection('nodes').find({
        eraLabel: 'Deep South Era',
        isRegistered: true
    }).limit(5).project({ pubkey: 1 }).toArray();
    samples['Deep South Era'] = deepSouth.map(n => n.pubkey);

    const south = await db.collection('nodes').find({
        eraLabel: { $regex: /South Era/i },
        isRegistered: true
    }).limit(5).project({ pubkey: 1 }).toArray();
    samples['South Era'] = south.map(n => n.pubkey);

    const nullEra = await db.collection('nodes').find({
        eraLabel: null,
        isRegistered: true
    }).limit(5).project({ pubkey: 1 }).toArray();
    samples['null'] = nullEra.map(n => n.pubkey);

    await client.close();

    console.log('Sample nodes per era:', samples);

    // Now inspect on-chain registry data using Helius
    const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' });

    for (const [era, nodes] of Object.entries(samples)) {
        console.log(`\n=== ${era} Era Nodes ===`);
        for (const nodeStr of nodes.slice(0, 2)) {
            try {
                const nodePubkey = new PublicKey(nodeStr);
                const [registryPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('registry'), nodePubkey.toBuffer()],
                    DEVNET_PROGRAM
                );

                const info = await connection.getAccountInfo(registryPda);
                if (!info) {
                    console.log(`  ${nodeStr}: No registry PDA`);
                    continue;
                }

                const data = info.data;
                console.log(`  ${nodeStr}:`);
                console.log(`    Data length: ${data.length} bytes`);

                // Parse fields
                if (data.length >= 42) {
                    const registrar = new PublicKey(data.slice(8, 40));
                    console.log(`    Registrar (8-40): ${registrar.toBase58()}`);
                }

                // Check the "price" field at offset 34
                if (data.length >= 42) {
                    const price = Number(data.readBigUInt64LE(34)) / 1e9;
                    console.log(`    Price/u64 (34-42): ${price} SOL`);
                }

                // Check if there's an era field stored explicitly (maybe at offset 32 or elsewhere)
                if (data.length >= 34) {
                    console.log(`    Byte 32: ${data[32]}`);
                    console.log(`    Byte 33: ${data[33]}`);
                    console.log(`    u16 at 32: ${data.readUInt16LE(32)}`);
                }

                if (data.length >= 74) {
                    const manager = new PublicKey(data.slice(42, 74));
                    console.log(`    Manager (42-74): ${manager.toBase58()}`);
                }

                // Show raw hex at key positions
                console.log(`    Raw hex 30-50: ${data.slice(30, 50).toString('hex')}`);

            } catch (e: any) {
                console.log(`  ${nodeStr}: Error - ${e.message}`);
            }
        }
    }
}

inspectEraData().catch(console.error);
