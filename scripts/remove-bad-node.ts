
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function removeBadNode() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        // Look for the node the user described
        const badNode = await nodesCol.findOne({
            $or: [
                { address: /127\.0\.0\.1/ },
                { address: /localhost/ },
                { pubkey: { $in: [null, "", "undefined", "null"] } }
            ]
        });

        if (badNode) {
            console.log(`Found bad node: ${badNode._id} (${badNode.address})`);
            const result = await nodesCol.deleteOne({ _id: badNode._id });
            console.log(`Deleted ${result.deletedCount} node.`);
        } else {
            console.log("No bad nodes (127.0.0.1 or missing pubkey) found.");

            // Just in case, if the count is still 225, let's see which one is "new"
            const count = await nodesCol.countDocuments();
            console.log(`Current count: ${count}`);
        }

    } finally {
        await client.close();
    }
}

removeBadNode().catch(console.error);
