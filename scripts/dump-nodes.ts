
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function dump(wallet: string) {
    const uri = process.env.MONGODB_URI;
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
        const nodes = await db.collection('nodes').find({
            $or: [
                { managerWallet: wallet },
                { registrarWallet: wallet }
            ]
        }).toArray();

        console.log(JSON.stringify(nodes, null, 2));
    } finally {
        await client.close();
    }
}

dump('CYxrrpDtELXmP5u5CBSA2KWaWzov2VmF5aRFJdGRLuVy');
