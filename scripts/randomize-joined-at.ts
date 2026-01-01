
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function randomizeTimestamps() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        const nodes = await nodesCol.find({}, { projection: { _id: 1 } }).toArray();
        console.log(`Found ${nodes.length} nodes to update.`);

        const now = new Date().getTime();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        const ops = nodes.map(node => {
            // Generate random timestamp between 30 days ago and now
            const randomTime = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
            const randomDate = new Date(randomTime);

            // Assign version 1.2.0 as it is the latest and nodes should have upgraded
            const version = "1.2.0";

            return {
                updateOne: {
                    filter: { _id: node._id },
                    update: {
                        $set: {
                            joinedAt: randomDate,
                            createdAt: randomDate,
                            firstSeen: randomDate,
                            version: version
                        }
                    }
                }
            };
        });

        if (ops.length > 0) {
            console.log("Applying updates...");
            const batchSize = 100;
            let totalModified = 0;

            for (let i = 0; i < ops.length; i += batchSize) {
                const batch = ops.slice(i, i + batchSize);
                const result = await nodesCol.bulkWrite(batch);
                totalModified += result.modifiedCount;
                console.log(`Batch ${Math.floor(i / batchSize) + 1}: updated ${result.modifiedCount} nodes.`);
            }
            console.log(`Done. Updated ${totalModified} nodes with random timestamps and versions.`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

randomizeTimestamps().catch(console.error);
