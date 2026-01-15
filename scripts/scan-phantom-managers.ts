
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI not found in environment');
}
console.log(`Using URI: ${uri.split('@')[1] || uri.split('//')[1]}`);

const client = new MongoClient(uri);
const DB_NAME = 'pGlobe';

async function main() {
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const nodes = db.collection('nodes');

        console.log(`Connected to ${DB_NAME}`);
        console.log('Scanning for unregistered nodes with managerWallet...');

        const query = {
            $and: [
                {
                    $or: [
                        { isRegistered: false },
                        { isRegistered: null },
                        { isRegistered: { $exists: false } }
                    ]
                },
                {
                    managerWallet: { $exists: true, $ne: null, $ne: "" }
                }
            ]
        };

        const invalidNodes = await nodes.find(query).toArray();

        console.log(`\nFound ${invalidNodes.length} nodes with invalid manager associations:`);

        if (invalidNodes.length > 0) {
            invalidNodes.forEach(node => {
                const id = node.pubkey || node.publicKey || node.id || node._id;
                console.log(`- Node: ${id}`);
                console.log(`  IP: ${node.address}`);
                console.log(`  Manager: ${node.managerWallet}`);
                console.log(`  Registered: ${node.isRegistered}`);
                console.log('---');
            });

            // Allow auto-fix argument
            if (process.argv.includes('--fix')) {
                console.log(`\nFixing ${invalidNodes.length} nodes...`);
                const ids = invalidNodes.map(n => n._id);
                const result = await nodes.updateMany(
                    { _id: { $in: ids } },
                    {
                        $unset: { managerWallet: "", managerPDA: "", registrarWallet: "" },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log(`✅ Cleaned up ${result.modifiedCount} nodes.`);
            } else {
                console.log(`\nRun with --fix to clean these up.`);
            }
        } else {
            console.log('✅ No issues found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
