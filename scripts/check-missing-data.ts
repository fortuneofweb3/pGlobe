
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function checkMissing() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI not found");
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCollection = db.collection("nodes");

        const total = await nodesCollection.countDocuments();
        const offline = await nodesCollection.countDocuments({ status: "offline" });
        const missingIp = await nodesCollection.countDocuments({ address: { $in: [null, ""] } });
        const missingLocation = await nodesCollection.countDocuments({ location: null });
        const missingCountry = await nodesCollection.countDocuments({ locationCountry: null });

        const offlineMissingAnything = await nodesCollection.countDocuments({
            status: "offline",
            $or: [
                { address: { $in: [null, ""] } },
                { location: null },
                { locationCountry: null }
            ]
        });

        console.log(`Total nodes: ${total}`);
        console.log(`Offline nodes: ${offline}`);
        console.log(`Nodes missing IP: ${missingIp}`);
        console.log(`Nodes missing Location: ${missingLocation}`);
        console.log(`Nodes missing Country: ${missingCountry}`);
        console.log(`Offline nodes missing ANY metadata: ${offlineMissingAnything}`);

        const sample = await nodesCollection.find({
            status: "offline",
            $or: [
                { address: { $in: [null, ""] } },
                { location: null },
                { locationCountry: null }
            ]
        }).limit(5).toArray();

        console.log("\nSample missing nodes:");
        sample.forEach(n => {
            console.log(`- ${n._id}: IP=${n.address}, Loc=${n.location}, Country=${n.locationCountry}`);
        });

    } finally {
        await client.close();
    }
}

checkMissing().catch(console.error);
