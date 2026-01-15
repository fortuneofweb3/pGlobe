
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

        console.log('Deleting duplicate nodes with Composite IDs...');

        // Delete any document where _id contains '_'
        // BUT verify it's not a valid IP like '127.0.0.1' (no underscores)
        // Composite format is ALWAYS Pubkey_IP.

        const result = await nodesCollection.deleteMany({
            _id: { $regex: /_/ }
        });

        console.log(`Deleted ${result.deletedCount} documents.`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
