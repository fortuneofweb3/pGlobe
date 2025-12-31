import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('pGlobe');

    // Get nodes from different months
    const janNodes = await db.collection('nodes').find({
        isRegistered: true,
        createdAt: { $gte: new Date('2025-01-01'), $lt: new Date('2025-02-01') }
    }).limit(3).toArray();

    const decNodes = await db.collection('nodes').find({
        isRegistered: true,
        createdAt: { $gte: new Date('2025-12-01'), $lt: new Date('2026-01-01') }
    }).limit(3).toArray();

    console.log('=== COMPARING NODES FROM DIFFERENT ERAS ===\n');

    for (const category of [
        { label: 'January (Deep South Era)', nodes: janNodes },
        { label: 'December (Should be South/Main Era)', nodes: decNodes }
    ]) {
        console.log(`\n### ${category.label} ###`);

        for (const node of category.nodes) {
            const [regPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), new PublicKey(node.pubkey).toBuffer()],
                DEVNET_PROGRAM
            );

            const info = await conn.getAccountInfo(regPda);
            if (!info) continue;

            console.log(`\nNode: ${node.pubkey}`);
            console.log(`Created: ${node.createdAt}`);
            console.log(`Current eraLabel: ${node.eraLabel}`);

            // Check all potentially relevant offsets
            console.log('\nRegistry Data Analysis:');
            console.log(`  Bytes 0-7 (Disc): ${info.data.slice(0, 8).toString('hex')}`);
            console.log(`  Byte 8: ${info.data[8]}`);
            console.log(`  Byte 9: ${info.data[9]}`);
            console.log(`  Bytes 30-33: ${info.data.slice(30, 34).toString('hex')}`);
            console.log(`  u16 at 32: ${info.data.readUInt16LE(32)}`);
            console.log(`  u16 at 34: ${info.data.readUInt16LE(34)} (price)`);
            console.log(`  u16 at 40: ${info.data.readUInt16LE(40)}`);
            console.log(`  Bytes 74-76: ${info.data.slice(74, 77).toString('hex')}`);

            // Check for Manager account
            const [manPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('manager'), new PublicKey(node.pubkey).toBuffer()],
                DEVNET_PROGRAM
            );
            const manInfo = await conn.getAccountInfo(manPda);
            console.log(`  Has Manager: ${manInfo ? 'YES' : 'NO'}`);
            if (manInfo) {
                console.log(`  Manager Era ID (offset 32): ${manInfo.data[32]}`);
            }
        }
    }

    await client.close();
}

run().catch(console.error);
