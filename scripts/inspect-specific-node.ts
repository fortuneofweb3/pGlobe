
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

        const targetPubkey = 'G6pCyVYaWEnAPLkoHbei3Jyx4RHwE1Dj9ZiEPM5KfjYN';
        console.log(`Inspecting node: ${targetPubkey}`);

        const node = await nodesCollection.findOne({
            $or: [
                { pubkey: targetPubkey },
                { publicKey: targetPubkey }
            ]
        });

        if (node) {
            console.log('\n--- Node Details ---');
            console.log('ID:', node._id);
            console.log('Pubkey:', node.pubkey || node.publicKey);
            console.log('Manager Wallet:', node.managerWallet);
            console.log('Registrar Wallet:', node.registrarWallet);
            console.log('Created At:', node.createdAt);
            console.log('Updated At:', node.updatedAt);
            console.log('Network:', node.network);
            console.log('Status:', node.status);
            console.log('IP:', node.ipAddress || node.address);
        } else {
            console.log('Node NOT found in DB!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
