import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');

    // Scan all 1040 byte accounts and find ones WITH Manager accounts
    const all = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    console.log('=== NODES WITH MANAGER ACCOUNTS ===\n');

    let foundCount = 0;
    for (const acc of all) {
        // Try to derive the node pubkey from the registry (it's at different offsets)
        // For legacy: offset 8-40
        // For new: offset 9-41

        // First try the "manager" PDA pattern
        // We don't know the node pubkey, so we'll check if a manager exists at common seeds

        // Actually, let's just check ALL accounts and find which have associated managers
        const possibleNodePk = acc.pubkey; // This is the registry PDA

        // We need to find the actual node pubkey - let's try searching for it in the data
        // Skip for now, let's use a different approach
    }

    console.log('Different approach: checking known nodes from DB with managers\\n');

    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('pGlobe');

    // Find nodes that we know have managers (from previous audit)
    const cursor = db.collection('nodes').find({ isRegistered: true });

    let withManager = [];
    let without = 0;

    for await (const node of cursor) {
        const [manPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), new PublicKey(node.pubkey).toBuffer()],
            DEVNET_PROGRAM
        );
        const manInfo = await conn.getAccountInfo(manPda);

        if (manInfo) {
            withManager.push({ node, manInfo });
        } else {
            without++;
        }

        if (withManager.length >= 10) break; // Get first 10 with managers
    }

    console.log(`Found ${withManager.length} nodes WITH managers, ${without} without\\n`);

    for (const { node, manInfo } of withManager) {
        const [regPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), new PublicKey(node.pubkey).toBuffer()],
            DEVNET_PROGRAM
        );
        const regInfo = await conn.getAccountInfo(regPda);

        console.log(`\\nNode: ${node.pubkey}`);
        console.log(`Manager Era ID: ${manInfo.data[32]}`);
        if (regInfo) {
            console.log(`Registry Byte 8: ${regInfo.data[8]}`);
            console.log(`Registry Offset 32: ${regInfo.data.readUInt16LE(32)}`);
            console.log(`Registry Price: ${regInfo.data.readUInt16LE(34)}`);
        }
    }

    await client.close();
}

run().catch(console.error);
