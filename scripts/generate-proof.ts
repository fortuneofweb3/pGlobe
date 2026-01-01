
import { MongoClient } from "mongodb";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function generateProof() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");
        const nodesCol = db.collection("nodes");

        const nodes = await nodesCol.find({}).toArray();
        const now = new Date();

        console.log("==========================================");
        console.log("   NODE DATABASE PROOF REPORT (SUMMARY)   ");
        console.log("==========================================");
        console.log(`Total Nodes: ${nodes.length}`);

        const stats = new Map<string, { count: number, ages: number[] }>();

        nodes.forEach(n => {
            const ver = n.version || "unknown";
            const joined = new Date(n.joinedAt);
            const ageDays = (now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24);

            if (!stats.has(ver)) stats.set(ver, { count: 0, ages: [] });
            const s = stats.get(ver)!;
            s.count++;
            s.ages.push(ageDays);
        });

        console.log("\nVersion | Count | Min Age (Days) | Max Age (Days) | Avg Age (Days)");
        console.log("---------------------------------------------------------------");

        const sortedVers = Array.from(stats.keys()).sort((a, b) => b.localeCompare(a));

        sortedVers.forEach(ver => {
            const s = stats.get(ver)!;
            const min = Math.min(...s.ages).toFixed(1);
            const max = Math.max(...s.ages).toFixed(1);
            const avg = (s.ages.reduce((a, b) => a + b, 0) / s.count).toFixed(1);
            console.log(`${ver.padEnd(8)} | ${s.count.toString().padEnd(5)} | ${min.padEnd(14)} | ${max.padEnd(14)} | ${avg}`);
        });

        console.log("\nRecent v1.2.x Nodes (Detailed Sample):");
        const recent = nodes
            .filter(n => n.version?.startsWith("1.2"))
            .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
            .slice(0, 5);

        recent.forEach(n => {
            console.log(`- ${n._id.toString().substring(0, 10)}... | Joined: ${n.joinedAt} (${((now.getTime() - new Date(n.joinedAt).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)} days ago)`);
        });

    } finally {
        await client.close();
    }
}

generateProof().catch(console.error);
