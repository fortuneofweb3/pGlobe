import 'dotenv/config';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function checkMissing() {
    const collection = await getNodesCollection();

    const total = await collection.countDocuments({});
    const withRegistrar = await collection.countDocuments({ registrarWallet: { $exists: true, $ne: null } });
    const missing = await collection.countDocuments({ registrarWallet: { $exists: false } });

    console.log(`Total Nodes in DB: ${total}`);
    console.log(`With Registrar: ${withRegistrar}`);
    console.log(`Missing Registrar: ${missing}`);

    // Sample 5 missing nodes
    if (missing > 0) {
        const samples = await collection.find({ registrarWallet: { $exists: false } }).limit(5).toArray();
        console.log('\nSample missing nodes:');
        samples.forEach(s => {
            console.log(`- ${s.pubkey} (Status: ${s.status}, Registered: ${s.isRegistered})`);
        });
    }

    process.exit(0);
}

checkMissing();
