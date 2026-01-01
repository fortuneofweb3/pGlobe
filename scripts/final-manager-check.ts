import 'dotenv/config';
import { fetchPNodesFromOnChain } from '../lib/server/solana-pnodes';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function finalCheck() {
    const onChainPubkeys = await fetchPNodesFromOnChain();
    const collection = await getNodesCollection();

    console.log(`On-chain Registered: ${onChainPubkeys.length}`);

    const dbTotalNodes = await collection.countDocuments({});
    console.log(`Total Nodes in DB: ${dbTotalNodes}`);

    const dbRegisteredNodes = await collection.find({ isRegistered: true }).toArray();
    console.log(`Registered Nodes in DB: ${dbRegisteredNodes.length}`);

    const dbPubkeys = new Set(dbRegisteredNodes.map(n => n.pubkey || n.publicKey));
    const missingInDbReg = onChainPubkeys.filter(pk => !dbPubkeys.has(pk));

    console.log(`Missing from DB "isRegistered: true" list: ${missingInDbReg.length}`);

    // Check if they exist at all in DB
    const results = await collection.find({
        $or: [
            { _id: { $in: missingInDbReg } as any },
            { pubkey: { $in: missingInDbReg } },
            { publicKey: { $in: missingInDbReg } }
        ]
    }).toArray();

    console.log(`Found in DB (but not marked as registered): ${results.length}`);
    console.log(`Completely missing from DB: ${missingInDbReg.length - results.length}`);

    if (results.length > 0) {
        console.log('\nSample of nodes in DB but not marked as registered:');
        results.slice(0, 5).forEach(r => {
            console.log(`- ${r._id || r.pubkey} (isRegistered: ${r.isRegistered}, Status: ${r.status})`);
        });
    }

    process.exit(0);
}

finalCheck().catch(err => {
    console.error(err);
    process.exit(1);
});
