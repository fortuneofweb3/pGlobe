import 'dotenv/config';
import { fetchPNodesFromOnChain } from '../lib/server/solana-pnodes';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function compareWithOnChain() {
    console.log('--- On-Chain vs Database Consistency Check ---');

    // 1. Fetch on-chain registered pubkeys
    const onChainPubkeys = await fetchPNodesFromOnChain();
    console.log(`On-chain Registry Count: ${onChainPubkeys.length}`);

    // 2. Fetch DB registered nodes
    const collection = await getNodesCollection();
    const dbRegisteredNodes = await collection.find({ isRegistered: true }).toArray();
    console.log(`Database Registered Count: ${dbRegisteredNodes.length}`);

    // 3. Find missing in DB
    const dbPubkeys = new Set(dbRegisteredNodes.map(n => n.pubkey || n.publicKey));
    const missingInDb = onChainPubkeys.filter(pk => !dbPubkeys.has(pk));

    if (missingInDb.length > 0) {
        console.log(`\n⚠️  Found ${missingInDb.length} nodes registered on-chain but NOT marked as registered in DB:`);
        missingInDb.forEach(pk => console.log(`- ${pk}`));
    } else if (onChainPubkeys.length === dbRegisteredNodes.length) {
        console.log('\n✅ On-chain count matches database registered count perfectly.');
    } else if (dbRegisteredNodes.length > onChainPubkeys.length) {
        console.log(`\nℹ️  Database has ${dbRegisteredNodes.length - onChainPubkeys.length} more registered nodes than the on-chain index account. This can happen if nodes were manually marked as registered or if the index account is lagging.`);
    }

    process.exit(0);
}

compareWithOnChain().catch(err => {
    console.error(err);
    process.exit(1);
});
