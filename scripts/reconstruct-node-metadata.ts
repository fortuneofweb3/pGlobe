
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function reconstruct() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");
        const historyCol = db.collection("node_history");

        // 1. Identify nodes that need help
        // metadata missing OR joinedAt missing
        const targetNodes = await nodesCol.find({
            $or: [
                { address: { $in: [null, ""] } },
                { location: null },
                { locationCountry: null },
                { joinedAt: null }
            ]
        }).toArray();

        console.log(`Found ${targetNodes.length} nodes needing restoration (Metadata or JoinedAt).`);
        if (targetNodes.length === 0) return;

        // Map of Pubkey -> Current Best Restoration Data
        // We initialize this with the missing nodes
        const restorationMap = new Map<string, any>();
        const targetPubkeys = new Set(targetNodes.map(n => n._id.toString()));

        // 2. Scan history systematically (one by one to avoid cursor timeouts)
        // We scan NEWEST to OLDEST.
        // - For IP/Location: We want the NEWEST valid data.
        // - For joinedAt: We want the OLDEST valid data.
        const historyMeta = await historyCol
            .find({}, { projection: { _id: 1, timestamp: 1 } })
            .sort({ timestamp: -1 })
            .toArray();

        console.log(`Found ${historyMeta.length} historical snapshots to scan.`);

        let snapshotsScanned = 0;

        for (const meta of historyMeta) {
            snapshotsScanned++;

            // Fetch full snapshot one by one
            const snapshot = await historyCol.findOne({ _id: meta._id });
            if (!snapshot) continue;

            const hNodes = snapshot.nodes || snapshot.nodeSnapshots || [];
            if (!Array.isArray(hNodes)) continue;

            for (const hNode of hNodes) {
                const pk = hNode.pubkey || hNode.publicKey || hNode.id;
                if (!pk || !targetPubkeys.has(pk)) continue;

                // We have a match for a target node in history
                const currentData = restorationMap.get(pk) || {};

                // --- STRATEGY: IP/LOCATION/VERSION (First Found = Newest) ---

                // IP Address
                if (!currentData.address && hNode.address) {
                    currentData.address = hNode.address;
                }

                // Location String
                if (!currentData.location && hNode.location) {
                    currentData.location = hNode.location;
                }

                // Structured Location
                if (!currentData.locationCountry) {
                    const loc = hNode.nodeLocation || hNode.locationData;
                    if (loc && loc.country) {
                        currentData.locationLat = loc.lat;
                        currentData.locationLon = loc.lon;
                        currentData.locationCity = loc.city;
                        currentData.locationCountry = loc.country;
                        currentData.locationCountryCode = loc.countryCode;
                    }
                }

                // Version
                if (!currentData.version && hNode.version) {
                    currentData.version = hNode.version;
                }

                // --- STRATEGY: JOINED AT (Last Found = Oldest) ---
                // Since we scan backwards, every time we see the node, we update 'joinedAt'.
                // The final value after the loop finishes will be the oldest timestamp.
                // We use the snapshot timestamp as the proxy for 'joinedAt'
                currentData.joinedAt = new Date(meta.timestamp); // Keep updating this!

                restorationMap.set(pk, currentData);
            }

            if (snapshotsScanned % 50 === 0) {
                console.log(`  > Scanned ${snapshotsScanned}/${historyMeta.length} snapshots.`);
            }
        }

        console.log(`\nScan complete. Scanned ${snapshotsScanned} snapshots.`);
        console.log(`Preparing updates for ${restorationMap.size} nodes.`);

        if (restorationMap.size > 0) {
            // Fetch original nodes again to only apply NECESSARY updates
            // (Don't overwrite existing good data if we somehow found worse data, though our logic prevents that mostly)
            // Actually, we trust our 'targetNodes' list. 
            // But we should be careful not to overwrite a non-null existing value with a restored value if the existing one was fine?
            // The search query selected nodes that had ANY missing field.
            // So a node might have Address but missing JoinedAt. 
            // Our logic above:
            // - 'currentData' starts empty.
            // - We fill 'address' only if '!currentData.address'. 
            // - BUT we didn't populate 'currentData' with the *existing DB data*.
            // - So 'currentData' only contains what we found in history.

            // CORRECT UPDATING LOGIC:
            // We need to merge 'currentData' into the REAL DB node, but only if the DB node is missing that field.

            const ops = [];

            for (const [pk, restored] of restorationMap) {
                const dbNode = targetNodes.find(n => n._id.toString() === pk);
                if (!dbNode) continue;

                const updates: any = {};

                // Update Address if missing
                if ((!dbNode.address || dbNode.address === "") && restored.address) {
                    updates.address = restored.address;
                }

                // Update Location if missing
                if (!dbNode.location && restored.location) {
                    updates.location = restored.location;
                }
                // Update Location details if missing
                if (!dbNode.locationCountry && restored.locationCountry) {
                    updates.locationLat = restored.locationLat;
                    updates.locationLon = restored.locationLon;
                    updates.locationCity = restored.locationCity;
                    updates.locationCountry = restored.locationCountry;
                    updates.locationCountryCode = restored.locationCountryCode;
                }

                // Update Version if missing
                if (!dbNode.version && restored.version) {
                    updates.version = restored.version;
                }

                // Update JoinedAt if missing
                // IMPORTANT: We trust our history scan to have found a 'joinedAt' (earliest seen).
                if (!dbNode.joinedAt && restored.joinedAt) {
                    updates.joinedAt = restored.joinedAt;
                    updates.createdAt = restored.joinedAt; // Fill createdAt too if we're at it
                    updates.firstSeen = restored.joinedAt; // Fill firstSeen too
                }

                if (Object.keys(updates).length > 0) {
                    ops.push({
                        updateOne: {
                            filter: { _id: pk },
                            update: { $set: updates }
                        }
                    });
                }
            }

            console.log(`Generated ${ops.length} update operations.`);

            const batchSize = 100;
            let modifiedCount = 0;
            for (let i = 0; i < ops.length; i += batchSize) {
                const batch = ops.slice(i, i + batchSize);
                const result = await nodesCol.bulkWrite(batch);
                modifiedCount += result.modifiedCount;
                console.log(`  > Updated batch ${Math.floor(i / batchSize) + 1}: ${result.modifiedCount} nodes modified.`);
            }
            console.log(`Total nodes updated: ${modifiedCount}`);
        }

    } catch (e) {
        console.error("Error during restoration:", e);
    } finally {
        await client.close();
    }
}

reconstruct().catch(console.error);
