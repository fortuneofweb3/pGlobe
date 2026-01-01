
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function verifyRandomization() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        const sample = await nodesCol.find({}, { limit: 5 }).toArray();
        console.log("Sample Nodes Verification:");
        sample.forEach(n => {
            console.log(`- ID: ${n._id}`);
            console.log(`  Joined: ${n.joinedAt}`);
            console.log(`  Version: ${n.version}`);
        });

        // Stats
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const inRange = await nodesCol.countDocuments({
            joinedAt: { $gte: thirtyDaysAgo, $lte: now }
        });
        const total = await nodesCol.countDocuments();

        console.log(`\nTotal Nodes: ${total}`);
        console.log(`Nodes inside 30-day window: ${inRange}`);
        console.log(`Success Rate: ${Math.round((inRange / total) * 100)}%`);

        const v12 = await nodesCol.countDocuments({ version: "1.2.0" });
        const v11 = await nodesCol.countDocuments({ version: "1.1.0" });
        const v10 = await nodesCol.countDocuments({ version: "1.0.0" });
        console.log(`\nVersion Distribution:`);
        console.log(`1.2.0: ${v12}`);
        console.log(`1.1.0: ${v11}`);
        console.log(`1.0.0: ${v10}`);

    } finally {
        await client.close();
    }
}

verifyRandomization().catch(console.error);
