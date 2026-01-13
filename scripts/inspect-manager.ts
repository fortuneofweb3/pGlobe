
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
        const managersCollection = db.collection('managers');

        const managerWallet = 'BeXhN2HfaAr3Ztc5okMBqoDznQ3rBnYcuXrjnht73EJF';
        console.log(`Inspecting manager: ${managerWallet}`);

        const manager = await managersCollection.findOne({ wallet: managerWallet });

        if (manager) {
            console.log('\n--- Manager Details ---');
            console.log('Wallet:', manager.wallet);
            console.log('Registered Nodes:', manager.registeredNodes);
            console.log('Purchased Nodes:', manager.purchasedNodes);
            console.log('Online Count:', manager.onlineCount);
            console.log('Known Nodes:', manager.knownNodes);
            console.log('Total Purchases:', manager.totalPurchases);
        } else {
            console.log('Manager NOT found in DB!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
