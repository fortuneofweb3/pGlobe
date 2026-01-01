
import { MongoClient } from "mongodb";

const MONGO_URI = "mongodb+srv://fortuneze0_db_user:ZKcIkgnaWjkNhGV8@pglobe.6wjzs7f.mongodb.net/pGlobe?retryWrites=true&w=majority";

async function restore() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        console.log("Searching for the clean snapshot (count=374)...");
        const snapshot = await db.collection("node_history").find({
            "nodeSnapshots.370": { $exists: true },
            "nodeSnapshots.400": { $exists: false }
        }).sort({ timestamp: -1 }).limit(1).toArray();

        if (snapshot.length === 0) {
            console.error("No clean snapshot found!");
            return;
        }

        const nodesToRestore = snapshot[0].nodeSnapshots;
        console.log(`Restoring from snapshot: ${new Date(snapshot[0].timestamp)} (${nodesToRestore.length} nodes)`);

        console.log("Wiping existing nodes...");
        await db.collection("nodes").deleteMany({});

        console.log("Inserting restored nodes with string IDs...");
        const finalNodes = nodesToRestore.map((n: any) => {
            const pubkey = n.pubkey || n.publicKey || n._id;
            const cleanNode = { ...n };
            delete cleanNode._id; // Remove objectId _id if it exists
            return {
                ...cleanNode,
                _id: pubkey.toString() // Ensure it's a string
            };
        });

        await db.collection("nodes").insertMany(finalNodes);

        const finalCount = await db.collection("nodes").countDocuments();
        console.log(`Restoration complete! Final node count: ${finalCount}`);

    } finally {
        await client.close();
    }
}

restore().catch(console.error);
