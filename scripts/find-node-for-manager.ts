
import { getDb } from '../lib/server/mongodb-nodes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function findNode() {
    const db = await getDb();
    const manager = 'Bx1aHrYYhrqKAHkJZE7qrbEBHX43LBKgsy3aBwu2h1Zr';

    console.log(`Searching for node with manager: ${manager}`);

    const node = await db.collection('nodes').findOne({ managerWallet: manager });

    if (node) {
        console.log(`FOUND NODE: ${node.pubkey || node.publicKey || node.id}`);
        console.log(`Manager: ${node.managerWallet}`);
    } else {
        console.log('No node found for this manager.');
    }
    process.exit(0);
}

findNode();
