/**
 * Refine era data based on user feedback:
 * 1. Unregistered nodes should NOT have era data.
 * 2. Re-fetch era data for all registered nodes.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const XANDEUM_DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');


async function refineEraData() {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
    const nodesCollection = db.collection('nodes');

    // 1. Clear era data from unregistered nodes
    console.log('Clearing era data from unregistered nodes...');
    const clearResult = await nodesCollection.updateMany(
        {
            $or: [
                { isRegistered: { $ne: true } },
                { eraLabel: 'Standard' }
            ]
        },
        { $unset: { eraLabel: "", eraBoost: "" } }
    );
    console.log(`Cleared era data for ${clearResult.modifiedCount} unregistered nodes.`);

    // 2. Re-fetch era data for all registered nodes
    const registeredNodes = await nodesCollection.find({ isRegistered: true }).project({ pubkey: 1 }).toArray();
    console.log(`Re-fetching era data for ${registeredNodes.length} registered nodes...`);

    const connection = new Connection(XANDEUM_DEVNET_RPC, 'confirmed');
    const { enrichPNodeWithOnChainData } = await import('../lib/server/solana-pnodes');

    let updatedCount = 0;

    for (const node of registeredNodes) {
        try {
            const data = await enrichPNodeWithOnChainData(node.pubkey, connection);

            if (data && !data.error) {
                await nodesCollection.updateOne(
                    { pubkey: node.pubkey },
                    {
                        $set: {
                            eraLabel: data.eraLabel,
                            eraBoost: data.eraBoost,
                            boostFactor: (data.eraBoost || 1) * (data.nftBoost || 1)
                        }
                    }
                );
                updatedCount++;
                console.log(`  Updated ${node.pubkey}: ${data.eraLabel} (Boost: ${data.eraBoost}x)`);
            } else {
                console.warn(`  Failed to enrich ${node.pubkey}:`, data?.error || 'Unknown error');
            }
        } catch (e: any) {
            console.error(`  Error processing ${node.pubkey}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 200)); // Respect rate limits
    }

    console.log(`\nRe-fetch complete. Updated ${updatedCount} registered nodes.`);
    await client.close();
}

refineEraData().catch(console.error);
