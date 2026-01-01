
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function checkJoinedAt() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        const total = await nodesCol.countDocuments();

        // Check for various date fields
        const missingJoinedAt = await nodesCol.countDocuments({ joinedAt: null });
        const missingCreatedAt = await nodesCol.countDocuments({ createdAt: null });
        const missingFirstSeen = await nodesCol.countDocuments({ firstSeen: null });

        console.log(`Total nodes: ${total}`);
        console.log(`Missing joinedAt: ${missingJoinedAt}`);
        console.log(`Missing createdAt: ${missingCreatedAt}`);
        console.log(`Missing firstSeen: ${missingFirstSeen}`);

        // Sample a good node
        const goodNode = await nodesCol.findOne({ joinedAt: { $ne: null } });
        console.log("Sample node with joinedAt:", goodNode ? JSON.stringify(goodNode, null, 2) : "None found");

        // Sample a bad node
        const badNode = await nodesCol.findOne({ joinedAt: null });
        console.log("Sample node WITHOUT joinedAt:", badNode ? JSON.stringify(badNode, null, 2) : "None found");

    } finally {
        await client.close();
    }
}

checkJoinedAt().catch(console.error);
