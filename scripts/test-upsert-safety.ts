
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { MongoClient } from 'mongodb';
import { PNode } from '../lib/types/pnode';
import { upsertNodes } from '../lib/server/mongodb-nodes';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri as string);

async function main() {
    try {
        console.log('🧪 Starting Upsert Safety Test...');

        // 1. Setup Test DB connection (we'll use the main DB but careful with IDs)
        // We will use a fake IP for testing to avoid messing with real data
        const TEST_IP = '999.999.999.999';
        const TEST_PUBKEY_A = 'PubkeyA_11111111111111111111111111111111';
        const TEST_PUBKEY_B = 'PubkeyB_22222222222222222222222222222222';

        await client.connect();
        const db = client.db('pGlobe');
        const nodesCollection = db.collection('nodes');

        // Cleanup previous test runs
        await nodesCollection.deleteOne({ _id: TEST_IP });

        // 2. Insert Initial Node (Pubkey A)
        console.log(`\nStep 1: Upserting Node with Pubkey A at IP ${TEST_IP}`);
        const nodeA: PNode = {
            address: `${TEST_IP}:9001`,
            pubkey: TEST_PUBKEY_A,
            status: 'online',
            network: 'devnet'
        };
        await upsertNodes([nodeA]);

        // Verify Step 1
        let doc = await nodesCollection.findOne({ _id: TEST_IP });
        console.log(`- Check: Document exists? ${!!doc}`);
        console.log(`- Check: Pubkey is A? ${doc?.pubkey === TEST_PUBKEY_A}`);

        if (!doc || doc.pubkey !== TEST_PUBKEY_A) {
            throw new Error('FAILED: Initial upsert failed.');
        }

        // 3. Upsert SAME Node with NEW Pubkey (Pubkey B) - Simulating rotation
        console.log(`\nStep 2: Upserting SAME Node (IP ${TEST_IP}) with Pubkey B`);
        const nodeB: PNode = {
            address: `${TEST_IP}:9001`,
            pubkey: TEST_PUBKEY_B,
            status: 'online',
            network: 'devnet'
        };
        await upsertNodes([nodeB]);

        // 4. Verification
        console.log('\n--- VERIFICATION ---');

        // Check 1: Does the document still exist?
        doc = await nodesCollection.findOne({ _id: TEST_IP });
        console.log(`1. Document exists: ${!!doc}`);

        // Check 2: Did it update to Pubkey B?
        console.log(`2. Pubkey updated to B: ${doc?.pubkey === TEST_PUBKEY_B} (Current: ${doc?.pubkey})`);

        // Check 3: Are there any duplicates?
        const count = await nodesCollection.countDocuments({
            $or: [{ pubkey: TEST_PUBKEY_A }, { pubkey: TEST_PUBKEY_B }]
        });
        console.log(`3. Total documents matching A or B: ${count} (Should be 1)`);

        if (count === 1 && doc?.pubkey === TEST_PUBKEY_B) {
            console.log('\n✅ TEST PASSED: Identity rotation handled correctly. No duplicates created.');
        } else {
            console.error('\n❌ TEST FAILED: Duplicates detected or update failed.');
        }

        // Cleanup
        await nodesCollection.deleteOne({ _id: TEST_IP });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        process.exit(0); // Force exit to close mongo client
    }
}

main();
