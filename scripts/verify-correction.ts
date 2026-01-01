
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function verifyCorrection() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        const sample = await nodesCol.find({}, { limit: 10 }).toArray();
        console.log("Sample Verification:");
        sample.forEach(n => {
            const joined = new Date(n.joinedAt);
            const now = new Date();
            const daysOld = Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`- Ver: ${n.version} | Joined: ${daysOld} days ago (${n.joinedAt})`);
        });

        // Stats
        const v12 = await nodesCol.countDocuments({ version: /^1\.2/ });
        const v11 = await nodesCol.countDocuments({ version: /^1\.1/ });
        const v10 = await nodesCol.countDocuments({ version: /^1\.0/ });
        const other = await nodesCol.countDocuments({ version: { $not: /^1\.[012]/ } });

        console.log(`\nDistribution:`);
        console.log(`1.2.x: ${v12}`);
        console.log(`1.1.x: ${v11}`);
        console.log(`1.0.x: ${v10}`);
        console.log(`Other: ${other}`);

    } finally {
        await client.close();
    }
}

verifyCorrection().catch(console.error);
