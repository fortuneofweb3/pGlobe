
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri as string);

async function main() {
    try {
        await client.connect();
        const db = client.db('pGlobe');
        const nodesCollection = db.collection('nodes');

        console.log('Scanning for duplicate nodes (Composite IDs vs IP IDs)...');

        const allNodes = await nodesCollection.find({}).toArray();
        console.log(`Total documents: ${allNodes.length}`);

        const compositeNodes = allNodes.filter(n => n._id.includes('_') && n._id.length > 20); // Heuristic for pubkey_ip
        const ipNodes = allNodes.filter(n => !n._id.includes('_'));

        console.log(`Composite ID Nodes (to delete): ${compositeNodes.length}`);
        console.log(`Standard IP ID Nodes (to keep): ${ipNodes.length}`);

        if (compositeNodes.length > 0) {
            console.log('\nSample Composite IDs:');
            compositeNodes.slice(0, 5).forEach(n => console.log(`- ${n._id} (Pubkey: ${n.pubkey})`));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
