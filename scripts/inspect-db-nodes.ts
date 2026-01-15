
import { getDb } from '../lib/server/mongodb-nodes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspectNodes() {
    const db = await getDb();
    const nodes = await db.collection('nodes').find({}).limit(5).toArray();
    console.log('Sample Nodes from DB:');
    nodes.forEach(n => {
        console.log({
            id: n.id,
            publicKey: n.publicKey,
            pubkey: n.pubkey,
            address: n.address
        });
    });
    process.exit(0);
}

inspectNodes().catch(console.error);
