
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function sampleData() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        console.log("\n--- Sample Activity Log ---");
        const activity = await db.collection("activity_logs").findOne({});
        console.log(JSON.stringify(activity, null, 2));

        console.log("\n--- Sample Region History ---");
        const region = await db.collection("region_history").findOne({});
        console.log(JSON.stringify(region, null, 2));

        console.log("\n--- Sample Node History ---");
        const nodeH = await db.collection("node_history").findOne({});
        if (nodeH) {
            // Don't log all nodes, just the structure
            const { nodes, nodeSnapshots, ...rest } = nodeH as any;
            console.log(JSON.stringify(rest, null, 2));
            console.log(`Nodes count in this snapshot: ${(nodes || nodeSnapshots || []).length}`);
            if ((nodes || nodeSnapshots || []).length > 0) {
                console.log("Sample node in history:", JSON.stringify((nodes || nodeSnapshots || [])[0], null, 2));
            }
        }

    } finally {
        await client.close();
    }
}

sampleData().catch(console.error);
