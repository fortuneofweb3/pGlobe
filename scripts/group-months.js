const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('pGlobe');
    const nodes = await db.collection('nodes').find({ isRegistered: true }).project({ createdAt: 1, pubkey: 1 }).toArray();
    const months = {};
    
    nodes.forEach(n => {
        if (!n.createdAt) return;
        const d = new Date(n.createdAt);
        const key = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0');
        months[key] = (months[key] || 0) + 1;
    });
    
    console.log('Registered Nodes by Month:');
    console.log(JSON.stringify(months, null, 2));
    await client.close();
}
run().catch(console.error);
