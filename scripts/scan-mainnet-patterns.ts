
import { Connection, PublicKey } from "@solana/web3.js";
import { MongoClient } from "mongodb";

const MONGO_URI = "mongodb+srv://fortuneze0_db_user:ZKcIkgnaWjkNhGV8@pglobe.6wjzs7f.mongodb.net/pGlobe?retryWrites=true&w=majority";
const MAINNET_RPC = "https://api.mainnet.xandeum.com";
const PROGRAM_ID = new PublicKey("6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL");

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
    return Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
}

async function scan() {
    const conn = new Connection(MAINNET_RPC, "confirmed");
    console.log("🚀 Starting Robust Mainnet Node Scan...");

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db("pGlobe");

        console.log("Fetching up to 15 nodes for analysis...");
        const dbNodes = await db.collection("nodes").find({
            $or: [
                { version: { $regex: /^1\./ } },
                { eraLabel: /Main Era/ }
            ]
        }).limit(15).toArray();

        const pubkeys = dbNodes.map(n => n.pubkey || n.publicKey);
        console.log(`Found ${pubkeys.length} relevant nodes in database.`);

        const [globalPDA] = PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM_ID);
        const globalInfo = await withTimeout(conn.getAccountInfo(globalPDA), 5000);
        console.log(`Global PDA (${globalPDA.toBase58()}): Len=${globalInfo?.data?.length || 'NULL'}`);

        for (const pubkey of pubkeys) {
            console.log(`\n--- Node: ${pubkey} ---`);
            const nodePk = new PublicKey(pubkey);
            const [registry] = PublicKey.findProgramAddressSync([Buffer.from("registry"), nodePk.toBuffer()], PROGRAM_ID);
            const [manager] = PublicKey.findProgramAddressSync([Buffer.from("manager"), nodePk.toBuffer()], PROGRAM_ID);

            try {
                const results = await Promise.all([
                    withTimeout(conn.getAccountInfo(nodePk), 3000),
                    withTimeout(conn.getAccountInfo(registry), 3000),
                    withTimeout(conn.getAccountInfo(manager), 3000)
                ]);

                const [node, reg, man] = results;

                if (!reg) {
                    console.log(`[Reg] NOT FOUND (Timeout or missing)`);
                } else {
                    const data = reg.data;
                    const rID32 = data.length >= 34 ? data.readUInt16LE(32) : 'n/a';
                    const b8 = data[8];
                    console.log(`[Reg] Len=${data.length}, EraID32=${rID32}, Byte8=${b8}`);
                    if (data.length >= 74) {
                        const owner = new PublicKey(data.slice(42, 74)).toBase58();
                        console.log(`[Reg] Owner Field (42-74): ${owner}`);
                    }
                }

                if (!man) {
                    console.log(`[Man] NOT FOUND`);
                } else {
                    const mID32 = man.data[32];
                    console.log(`[Man] Len=${man.data.length}, EraID32_v32=${mID32}`);
                }

                if (node) {
                    console.log(`[Node] Len=${node.data.length}, Balance=${node.lamports / 1e9} SOL`);
                }

            } catch (err) {
                console.warn(`Error on ${pubkey}:`, (err as Error).message);
            }
        }
    } finally {
        await client.close();
    }
}

scan().catch(console.error);
