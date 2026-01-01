
import { MongoClient } from "mongodb";

const MONGO_URI = "mongodb+srv://fortuneze0_db_user:ZKcIkgnaWjkNhGV8@pglobe.6wjzs7f.mongodb.net/pGlobe?retryWrites=true&w=majority";

async function restore() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        console.log("Searching for the correct historical snapshot...");
        // Source the snapshot from just before the deletion/pollution
        const snapshot = await db.collection("node_history").find({
            "nodeSnapshots.370": { $exists: true }
        }).sort({ timestamp: -1 }).limit(1).toArray();

        if (snapshot.length === 0) {
            console.error("No valid snapshot found!");
            return;
        }

        const nodesToRestore = snapshot[0].nodeSnapshots;
        console.log(`Found snapshot from ${new Date(snapshot[0].timestamp)} with ${nodesToRestore.length} nodes.`);

        let restoredCount = 0;
        let skippedPlaceholderCount = 0;

        const operations = nodesToRestore
            .filter((node: any) => {
                // Filter out the "random ass" onchain nodes
                // They have seenInGossip: false AND no storage committed usually, 
                // OR we can explicitly check for the source if we tracked it
                const isPlaceholder = node.seenInGossip === false && (!node.address || node.address === '');
                if (isPlaceholder) {
                    skippedPlaceholderCount++;
                    return false;
                }
                return true;
            })
            .map((node: any) => {
                const pubkey = node.pubkey || node.publicKey;
                return {
                    updateOne: {
                        filter: { $or: [{ pubkey }, { publicKey: pubkey }] },
                        update: { $set: node },
                        upsert: true
                    }
                };
            });

        console.log(`Prepared ${operations.length} operations (Skipped ${skippedPlaceholderCount} placeholders).`);

        if (operations.length > 0) {
            const result = await db.collection("nodes").bulkWrite(operations);
            console.log(`Sync complete! Upserted/Updated ${result.upsertedCount + result.modifiedCount} nodes.`);
        }

        const finalCount = await db.collection("nodes").countDocuments();
        console.log(`Final total nodes in DB: ${finalCount}`);

    } finally {
        await client.close();
    }
}

restore().catch(console.error);
