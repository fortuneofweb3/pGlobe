
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI not found in environment');
}
console.log(`Using URI: ${uri.split('@')[1] || uri.split('//')[1]}`); // Masked

const client = new MongoClient(uri);

const BAD_NODE = 'DJXVVM8J2xhe5dERZ4je4ZySVNYcSyT55fXMmXJ4wij9';
const MANAGER = 'D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2';

async function main() {
    try {
        await client.connect();

        // List databases
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log('Available databases:', dbs.databases.map(db => db.name).join(', '));

        // Try pGlobe (default in code)
        console.log('\n--- Checking DB: pGlobe ---');
        await checkDb(client.db('pGlobe'));

        // Try xandeum (previous guess)
        console.log('\n--- Checking DB: xandeum ---');
        await checkDb(client.db('xandeum'));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function checkDb(db: any) {
    const nodes = db.collection('nodes');
    const total = await nodes.countDocuments();
    console.log(`Total nodes in ${db.databaseName}: ${total}`);

    if (total > 0) {
        console.log(`--- Inspecting Node ${BAD_NODE} in ${db.databaseName} ---`);
        const node = await nodes.findOne({
            $or: [{ id: BAD_NODE }, { pubkey: BAD_NODE }, { publicKey: BAD_NODE }]
        });

        if (node) {
            console.log(JSON.stringify(node, null, 2));
        } else {
            console.log('Node not found in this DB.');
        }

        console.log(`--- Inspecting Manager ${MANAGER} in ${db.databaseName} ---`);
        const ownedNodes = await nodes.find({ managerWallet: MANAGER }).toArray();
        console.log(`Found ${ownedNodes.length} nodes for this manager.`);
        ownedNodes.forEach((n: any) => {
            console.log(`- ${n.pubkey || n.publicKey || n.id} (Status: ${n.status}, Registered: ${n.isRegistered})`);
        });
    }
}

main();
