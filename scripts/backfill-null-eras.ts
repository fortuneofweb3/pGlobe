/**
 * Backfill era data for nodes with null era
 * Uses Helius API for more reliable RPC calls
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_DEVNET_RPC = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

// Era thresholds based on registration price
function getEraFromPrice(price: number): { eraBoost: number; eraLabel: string } {
    if (price <= 0) {
        return { eraBoost: 1, eraLabel: 'Standard' };
    }
    if (price < 2.0) {
        return { eraBoost: 16, eraLabel: 'Deep South Era' };
    } else if (price < 3.0) {
        return { eraBoost: 10, eraLabel: 'South Era' };
    } else if (price < 4.0) {
        return { eraBoost: 7, eraLabel: 'Main Era' };
    } else if (price < 5.0) {
        return { eraBoost: 3.5, eraLabel: 'Coal Era' };
    } else if (price < 6.0) {
        return { eraBoost: 2, eraLabel: 'Central Era' };
    } else {
        return { eraBoost: 1.25, eraLabel: 'North Era' };
    }
}

async function backfillNullEras() {
    const mongoClient = new MongoClient(process.env.MONGODB_URI as string);
    await mongoClient.connect();
    const db = mongoClient.db('pGlobe');

    // Get all nodes with null era
    const nullEraNodes = await db.collection('nodes').find({
        eraLabel: null
    }).project({ pubkey: 1, isRegistered: 1 }).toArray();

    console.log(`Found ${nullEraNodes.length} nodes with null era`);

    // Try Helius first, fallback to Xandeum Devnet
    let connection: Connection;
    try {
        connection = new Connection(HELIUS_DEVNET_RPC, { commitment: 'confirmed' });
        await connection.getSlot(); // Test connection
        console.log('Using Helius Devnet RPC');
    } catch {
        connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' });
        console.log('Falling back to Xandeum Devnet RPC');
    }

    let updated = 0;
    let notRegistered = 0;
    let noRegistryData = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < nullEraNodes.length; i += batchSize) {
        const batch = nullEraNodes.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nullEraNodes.length / batchSize)}...`);

        // Get registry PDAs for batch, filtering out invalid pubkeys
        const validBatch: typeof batch = [];
        const registryPDAs: PublicKey[] = [];

        for (const node of batch) {
            if (!node.pubkey || typeof node.pubkey !== 'string') {
                console.log(`  Skipping node with invalid pubkey: ${JSON.stringify(node)}`);
                continue;
            }
            try {
                const nodePubkey = new PublicKey(node.pubkey);
                const [pda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('registry'), nodePubkey.toBuffer()],
                    DEVNET_PROGRAM
                );
                validBatch.push(node);
                registryPDAs.push(pda);
            } catch (e) {
                console.log(`  Invalid pubkey: ${node.pubkey}`);
            }
        }

        if (registryPDAs.length === 0) {
            console.log('  No valid pubkeys in batch, skipping...');
            continue;
        }

        // Fetch all accounts in batch
        const accounts = await connection.getMultipleAccountsInfo(registryPDAs);

        for (let j = 0; j < validBatch.length; j++) {
            const node = validBatch[j];
            const accountInfo = accounts[j];

            if (!accountInfo) {
                // No registry = not registered, set to Standard
                await db.collection('nodes').updateOne(
                    { pubkey: node.pubkey },
                    {
                        $set: {
                            eraLabel: 'Standard',
                            eraBoost: 1,
                            isRegistered: false
                        }
                    }
                );
                notRegistered++;
                continue;
            }

            const data = accountInfo.data;
            if (data.length < 42) {
                console.log(`  ${node.pubkey}: Short data (${data.length} bytes)`);
                noRegistryData++;
                continue;
            }

            try {
                // Read price from bytes 34-42
                const price = Number(data.readBigUInt64LE(34)) / 1e9;
                const { eraBoost, eraLabel } = getEraFromPrice(price);

                // Extract wallets
                const registrarWallet = new PublicKey(data.slice(8, 40)).toBase58();
                let managerWallet: string | undefined;
                if (data.length >= 74) {
                    managerWallet = new PublicKey(data.slice(42, 74)).toBase58();
                }

                // Update database
                const updateFields: any = {
                    eraLabel,
                    eraBoost,
                    isRegistered: true,
                    registrarWallet
                };
                if (managerWallet) {
                    updateFields.managerWallet = managerWallet;
                }

                await db.collection('nodes').updateOne(
                    { pubkey: node.pubkey },
                    { $set: updateFields }
                );

                console.log(`  ${node.pubkey}: ${eraLabel} (${price.toFixed(4)} SOL)`);
                updated++;

            } catch (e: any) {
                console.log(`  ${node.pubkey}: Error - ${e.message}`);
                errors++;
            }
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n=== Summary ===');
    console.log(`Total null-era nodes: ${nullEraNodes.length}`);
    console.log(`Updated with era: ${updated}`);
    console.log(`Set to Standard (not registered): ${notRegistered}`);
    console.log(`No registry data: ${noRegistryData}`);
    console.log(`Errors: ${errors}`);

    await mongoClient.close();
}

backfillNullEras().catch(console.error);
