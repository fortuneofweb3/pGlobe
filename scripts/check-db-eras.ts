
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'pGlobe';

async function checkDbEras() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not set');
        return;
    }

    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB_NAME);
        const collection = db.collection('nodes');

        const total = await collection.countDocuments();
        const eras = await collection.aggregate([
            { $group: { _id: '$eraLabel', count: { $sum: 1 }, avgBoost: { $avg: '$eraBoost' } } }
        ]).toArray();

        console.log(`Total nodes in DB: ${total}`);
        console.log('Era Distribution:');
        eras.forEach(e => {
            console.log(`- ${e._id || 'null'}: ${e.count} nodes (Avg Boost: ${e.avgBoost})`);
        });

        const samples = await collection.find({ eraLabel: 'Standard' }).limit(5).toArray();
        if (samples.length > 0) {
            console.log('\nSample "Standard" nodes:');
            samples.forEach(s => {
                console.log(`- ${s.pubkey}: isRegistered=${s.isRegistered}, balance=${s.balance}`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

checkDbEras();
