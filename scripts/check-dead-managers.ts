
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function checkDeadManagers() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI not set");
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        // 1. Get all nodes
        const nodes = await db.collection("nodes").find({}).toArray();

        // 2. Group by manager
        const managerNodes = new Map();
        for (const node of nodes) {
            const wallet = node.managerWallet || node.registrarWallet;
            if (!wallet) continue;
            if (!managerNodes.has(wallet)) managerNodes.set(wallet, []);
            managerNodes.get(wallet).push(node);
        }

        // 3. Count dead managers
        let deadCount = 0;
        const deadManagers = [];

        for (const [wallet, nList] of managerNodes.entries()) {
            const allOffline = nList.every(n => n.status === "offline");
            if (allOffline) {
                deadCount++;
                deadManagers.push({
                    wallet,
                    nodeCount: nList.length,
                    sampleNode: nList[0].pubkey || nList[0].publicKey
                });
            }
        }

        console.log(`\n--- Dead Managers Check ---`);
        console.log(`Total Managers with nodes: ${managerNodes.size}`);
        console.log(`Dead Managers (all nodes offline): ${deadCount}`);

        if (deadCount > 0) {
            console.log("\nSample Dead Managers:");
            console.table(deadManagers.slice(0, 10));
        }

        // 4. Check for offline nodes without wallets
        const offlineNoWallet = nodes.filter(n => n.status === "offline" && !n.managerWallet && !n.registrarWallet);
        console.log(`\nOffline nodes WITHOUT wallet link: ${offlineNoWallet.length}`);
        if (offlineNoWallet.length > 0) {
            console.log("Example:", offlineNoWallet[0].pubkey || offlineNoWallet[0].publicKey);
        }

    } finally {
        await client.close();
    }
}

checkDeadManagers();
