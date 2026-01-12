
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
    const uri = process.env.MONGODB_URI;
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
        const nodes = await db.collection('nodes').find({ network: 'mainnet' }).limit(5).toArray();
        console.log('MAINNET_NODES_IN_DB_COUNT:', await db.collection('nodes').countDocuments({ network: 'mainnet' }));
        console.log('SAMPLE_MAINNET_NODES:', JSON.stringify(nodes.map(n => ({ ip: n._id, network: n.network, mainnetCredits: n.mainnetCredits, credits: n.credits })), null, 2));

        const allNetworks = await db.collection('nodes').distinct('network');
        console.log('DISTINCT_NETWORKS:', allNetworks);
    } finally {
        await client.close();
    }
}
check();
