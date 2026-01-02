/**
 * Refine era data based on user feedback:
 * 1. Process ALL nodes (registered and unregistered).
 * 2. Use version data to determine era and milestone.
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function refineEraData() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not defined');
        return;
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
    const nodesCollection = db.collection('nodes');

    // 1. Process ALL nodes to assign era based on version
    const allNodes = await nodesCollection.find({}).project({ pubkey: 1, version: 1 }).toArray();
    console.log(`Processing era data for ${allNodes.length} nodes...`);

    const { getItemForVersion, getEraForItem, getMilestoneLabel } = await import('../lib/constants/eras');

    let updatedCount = 0;

    for (const node of allNodes) {
        if (!node.version) continue;

        try {
            const milestoneItem = getItemForVersion(node.version);
            if (milestoneItem > 0) {
                const era = getEraForItem(milestoneItem);
                const milestoneLabel = getMilestoneLabel(milestoneItem);
                const eraLabel = `${era.name} (${milestoneLabel})`;
                const eraBoost = era.boost;

                await nodesCollection.updateOne(
                    { pubkey: node.pubkey },
                    {
                        $set: {
                            eraLabel,
                            milestoneItem,
                            eraBoost,
                            boostFactor: (eraBoost || 1) // NFT boost handled separately during sync if needed
                        }
                    }
                );
                updatedCount++;
                if (updatedCount % 50 === 0) {
                    console.log(`  Processed ${updatedCount} nodes...`);
                }
            }
        } catch (e: any) {
            console.error(`  Error processing ${node.pubkey}:`, e.message);
        }
    }

    console.log(`\nProcessing complete. Updated ${updatedCount} nodes.`);
    await client.close();
}

refineEraData().catch(console.error);
