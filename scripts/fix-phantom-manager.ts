
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI not found in environment');
}
console.log(`Using URI: ${uri.split('@')[1] || uri.split('//')[1]}`);

const client = new MongoClient(uri);

// The phantom node (from previous debug output)
const NODE_PUBKEY = 'DJXVVM8J2xhe5dERZ4je4ZySVNYcSyT55fXMmXJ4wij9';
const DB_NAME = 'pGlobe'; // Confirmed from debug script

async function main() {
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const nodes = db.collection('nodes');

        console.log(`Connected to ${DB_NAME}`);

        // 1. Find the node
        const node = await nodes.findOne({
            $or: [{ pubkey: NODE_PUBKEY }, { publicKey: NODE_PUBKEY }]
        });

        if (!node) {
            console.error('❌ Node not found!');
            return;
        }

        console.log(`Found node: ${node._id}`);
        console.log(`Current Manager: ${node.managerWallet}`);

        if (!node.managerWallet) {
            console.log('✅ Node already has no manager.');
            return;
        }

        // 2. Update the node
        const result = await nodes.updateOne(
            { _id: node._id },
            {
                $unset: { managerWallet: "" },
                $set: { updatedAt: new Date() }
            }
        );

        console.log(`Modified count: ${result.modifiedCount}`);

        if (result.modifiedCount > 0) {
            console.log('✅ Successfully removed manager association.');
        } else {
            console.warn('⚠️ No changes made.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
