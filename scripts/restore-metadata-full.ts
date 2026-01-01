
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function restoreMetadata() {
    const uri = process.env.MONGODB_URI;
    if (!uri || !uri.startsWith("mongodb")) {
        console.error("MONGODB_URI not found or invalid in .env.local:", uri);
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        console.log("[MongoDB] ✅ Connected for restoration.");

        const masterMap = new Map<string, any>();

        // 1. Load from local backup if exists
        const localBackupPath = path.join(process.cwd(), "investigation/local-pnodes.json");
        if (fs.existsSync(localBackupPath)) {
            console.log("Loading metadata from local backup...");
            const localData = JSON.parse(fs.readFileSync(localBackupPath, "utf-8"));
            const nodes = Array.isArray(localData) ? localData : (localData.nodes || localData.nodeSnapshots || []);

            for (const node of nodes) {
                const pk = node.pubkey || node.publicKey || node.id;
                if (!pk) continue;
                if (!masterMap.has(pk)) {
                    masterMap.set(pk, { ...node, source: "local" });
                }
            }
            console.log(`Loaded ${masterMap.size} nodes from local backup.`);
        }

        // 2. Load from historical snapshots as fallback/augmentation
        console.log("Fetching historical snapshots from DB...");
        // Use cursor for memory efficiency when scanning lots of history
        const historyCollection = db.collection("node_history");
        const totalHistoryDocs = await historyCollection.countDocuments();
        console.log(`History contains ${totalHistoryDocs} snapshots mapping to multiple nodes Each.`);

        const cursor = historyCollection.find().sort({ timestamp: -1 }).limit(1000);
        let historyRestored = 0;
        let snapshotsProcessed = 0;

        while (await cursor.hasNext()) {
            const snapshot = await cursor.next();
            if (!snapshot) continue;

            snapshotsProcessed++;
            console.log(`[Snapshot] ${snapshotsProcessed}/500: Processing snapshot from ${new Date(snapshot.timestamp).toISOString()}`);

            const hNodes = snapshot.nodes || snapshot.nodeSnapshots;
            if (!hNodes || !Array.isArray(hNodes)) {
                console.log(`  > No nodes found in this snapshot document.`);
                continue;
            }

            let recoveredInThisSnapshot = 0;
            for (const node of hNodes) {
                const pk = node.pubkey || node.publicKey;
                if (!pk) continue;

                const existing = masterMap.get(pk);
                if (!existing) {
                    masterMap.set(pk, { ...node, source: "history" });
                    historyRestored++;
                    recoveredInThisSnapshot++;
                } else {
                    // Backfill missing data from history if local was incomplete
                    let backfilled = false;
                    if (!existing.address && node.address) { existing.address = node.address; backfilled = true; }
                    if (!existing.location && node.location) { existing.location = node.location; backfilled = true; }
                    if ((!existing.nodeLocation || !existing.locationCountry) && (node.nodeLocation || node.locationData)) {
                        existing.nodeLocation = node.nodeLocation || node.locationData;
                        if (node.locationCity) existing.locationCity = node.locationCity;
                        if (node.locationCountry) existing.locationCountry = node.locationCountry;
                        if (node.locationCountryCode) existing.locationCountryCode = node.locationCountryCode;
                        if (node.locationLat) existing.locationLat = node.locationLat;
                        if (node.locationLon) existing.locationLon = node.locationLon;
                        backfilled = true;
                    }
                    if (backfilled) recoveredInThisSnapshot++;
                }
            }
            if (recoveredInThisSnapshot > 0) {
                console.log(`  > Recovered/Backfilled ${recoveredInThisSnapshot} nodes in this snapshot.`);
            }
        }
        console.log(`Integrated history. Found data for ${historyRestored} new nodes from history. Total unique nodes in map: ${masterMap.size}`);

        // 3. Find nodes in DB that are MISSING metadata
        console.log("Identifying nodes with missing metadata in DB...");
        const missingNodes = await db.collection("nodes").find({
            $or: [
                { address: { $in: [null, ""] } },
                { location: null },
                { locationCountry: null }
            ]
        }).toArray();

        console.log(`Found ${missingNodes.length} nodes with missing metadata.`);

        const operations: any[] = [];
        let canRestoreCount = 0;

        for (const target of missingNodes) {
            const pk = target._id.toString();
            const backup = masterMap.get(pk);

            if (backup) {
                const updates: any = {};

                // Only update if the backup actually has the data
                if (backup.address && (!target.address || target.address === "")) {
                    updates.address = backup.address;
                }

                if (backup.location && !target.location) {
                    updates.location = backup.location;
                }

                const loc = backup.nodeLocation || backup.locationData;
                if (loc && !target.locationCountry) {
                    updates.locationLat = loc.lat;
                    updates.locationLon = loc.lon;
                    updates.locationCity = loc.city;
                    updates.locationCountry = loc.country;
                    updates.locationCountryCode = loc.countryCode;
                }

                // Also restore version if missing
                if (backup.version && !target.version) {
                    updates.version = backup.version;
                }

                if (Object.keys(updates).length > 0) {
                    canRestoreCount++;
                    operations.push({
                        updateOne: {
                            filter: { _id: pk },
                            update: { $set: updates }
                        }
                    });
                }
            }
        }

        console.log(`Prepared ${operations.length} targeted repairs out of ${missingNodes.length} missing nodes.`);

        if (operations.length > 0) {
            console.log(`Executing repair updates...`);
            const batchSize = 100;
            let totalModified = 0;
            for (let i = 0; i < operations.length; i += batchSize) {
                const batch = operations.slice(i, i + batchSize);
                const bulkResult = await db.collection("nodes").bulkWrite(batch);
                totalModified += bulkResult.modifiedCount;
                console.log(`Batch ${Math.floor(i / batchSize) + 1} complete. Modified: ${bulkResult.modifiedCount}`);
            }
            console.log(`Restoration finished. Total nodes updated: ${totalModified}`);
        } else {
            console.log("No repair operations needed/possible with available backup data.");
        }

    } catch (err) {
        console.error("Restoration failed:", err);
    } finally {
        await client.close();
    }
}

restoreMetadata().catch(console.error);
