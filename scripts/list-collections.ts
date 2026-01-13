
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri as string);

async function main() {
    try {
        await client.connect();
        const db = client.db('xglobe'); // Default DB

        console.log('Connected to DB. Listing collections...');
        const collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(`- ${c.name}`));

        // Also check if there are other DBs
        console.log('\nListing Databases:');
        const dbs = await client.db().admin().listDatabases();
        dbs.databases.forEach(d => console.log(`- ${d.name}`));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
