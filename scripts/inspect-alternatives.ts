
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function inspectOtherCollections() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        // Check Region History
        console.log("Checking region_history structure...");
        const regionDoc = await db.collection("region_history").findOne({});
        console.log("Region History Sample:", JSON.stringify(regionDoc, null, 2));

        // Check Activity Logs for any IP data
        console.log("\nChecking activity_logs structure...");
        const activityDoc = await db.collection("activity_logs").findOne({});
        console.log("Activity Log Sample:", JSON.stringify(activityDoc, null, 2));

        // Check if we can find a node with IP in activity logs
        // searching for a known field that might contain it
        // The sample in step 51 only showed credits. 

    } finally {
        await client.close();
    }
}

inspectOtherCollections().catch(console.error);
