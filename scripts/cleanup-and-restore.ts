
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function cleanupAndRestore() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");
        const historyCol = db.collection("node_history");

        // --- STEP 1: CLEANUP DEAD NODES ---
        console.log("--- Step 1: Cleaning up dead nodes ---");

        const deleteFilter = {
            status: "offline",
            $or: [
                { address: { $in: [null, ""] } },
                { location: null }
            ]
        };

        const nodesToDelete = await nodesCol.countDocuments(deleteFilter);
        console.log(`Found ${nodesToDelete} dead nodes to delete (retry check).`);

        if (nodesToDelete > 0) {
            const deleteResult = await nodesCol.deleteMany(deleteFilter);
            console.log(`Deleted ${deleteResult.deletedCount} nodes.`);
        } else {
            console.log("No dead nodes found (already cleaned?).");
        }

        // --- STEP 2: RESTORE TIMESTAMPS ---
        console.log("\n--- Step 2: Restoring Timestamps (Optimized) ---");

        const targetNodes = await nodesCol.find({}).project({ _id: 1 }).toArray();
        const targetPubkeys = new Set(targetNodes.map(n => n._id.toString()));
        console.log(`Scanning history for ${targetPubkeys.size} remaining nodes...`);

        const earliestSeenMap = new Map<string, Date>();

        // Optimized scan: Get meta first
        const historyMeta = await historyCol
            .find({}, { projection: { _id: 1, timestamp: 1 } })
            .sort({ timestamp: -1 }) // Newest first
            .toArray();

        console.log(`Scanning ${historyMeta.length} snapshots in parallel chunks...`);

        // Process in chunks to control concurrency
        const chunkSize = 50;
        let processed = 0;

        for (let i = 0; i < historyMeta.length; i += chunkSize) {
            const chunk = historyMeta.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (meta) => {
                const ts = new Date(meta.timestamp);

                // Fetch only necessary fields
                const snapshot = await historyCol.findOne(
                    { _id: meta._id },
                    { projection: { nodes: 1, nodeSnapshots: 1 } }
                );

                if (!snapshot) return;

                const hNodes = snapshot.nodes || snapshot.nodeSnapshots || [];
                if (!Array.isArray(hNodes)) return;

                for (const hNode of hNodes) {
                    const pk = hNode.pubkey || hNode.publicKey || hNode.id;
                    if (!pk || !targetPubkeys.has(pk)) continue;

                    // Update timestamp (since we go backwards, this finds older and older dates)
                    const existing = earliestSeenMap.get(pk);
                    if (!existing || ts < existing) {
                        earliestSeenMap.set(pk, ts);
                    }
                }
            }));

            processed += chunk.length;
            if (processed % 50 <= chunkSize) {
                console.log(`  > Processed ${processed}/${historyMeta.length} snapshots.`);
            }
        }

        console.log("Scan complete.");
        console.log(`Found timestamp data for ${earliestSeenMap.size} nodes.`);

        if (earliestSeenMap.size > 0) {
            console.log("Applying timestamp updates...");
            const ops = [];

            for (const [pk, earliestDate] of earliestSeenMap) {
                ops.push({
                    updateOne: {
                        filter: { _id: pk },
                        update: {
                            $set: {
                                joinedAt: earliestDate,
                                createdAt: earliestDate,
                                firstSeen: earliestDate
                            }
                        }
                    }
                });
            }

            const batchSize = 100;
            let modifiedCount = 0;
            for (let i = 0; i < ops.length; i += batchSize) {
                const batch = ops.slice(i, i + batchSize);
                const result = await nodesCol.bulkWrite(batch);
                modifiedCount += result.modifiedCount;
                console.log(`  > Updated batch ${Math.floor(i / batchSize) + 1}: ${result.modifiedCount} nodes modified.`);
            }
            console.log(`Total nodes updated with timestamps: ${modifiedCount}`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

cleanupAndRestore().catch(console.error);
