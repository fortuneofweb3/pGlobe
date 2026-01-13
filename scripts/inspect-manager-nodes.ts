
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

        const managerWallet = 'BeXhN2HfaAr3Ztc5okMBqoDznQ3rBnYcuXrjnht73EJF';

        console.log(`Querying nodes for manager: ${managerWallet}`);

        const nodes = await nodesCollection.find({
            $or: [
                { managerWallet: managerWallet },
                { registrarWallet: managerWallet }
            ]
        }).toArray();

        console.log(`Found ${nodes.length} documents.`);

        // Sort by createdAt desc
        nodes.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateA - dateB; // Ascending (oldest first)
        });

        console.log('\n--- Nodes (Ordered by Confirmation Time) ---');
        nodes.forEach((n, i) => {
            const created = n.createdAt ? new Date(n.createdAt).toISOString() : 'Unknown';
            const updated = n.updatedAt ? new Date(n.updatedAt).toISOString() : 'Unknown';
            console.log(`${i + 1}. Pubkey: ${n.pubkey || n.publicKey}`);
            console.log(`   Address: ${n.address || n.ipAddress}`);
            console.log(`   Created: ${created}`);
            console.log(`   Last Seen: ${n.lastSeen || updated}`);
            console.log(`   Network: ${n.network}`);
            console.log(`   Status: ${n.status}`);
            console.log(`   Manager: ${n.managerWallet}`);
            console.log(`   Registrar: ${n.registrarWallet}`);
            console.log('---');
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
