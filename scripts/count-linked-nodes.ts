
import { config } from 'dotenv';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

// Load environment variables
config();

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        const collection = await getNodesCollection();

        const allNodes = await collection.find({}).toArray();
        const total = allNodes.length;

        let hasManager = 0;
        let hasRegistrar = 0;
        let hasBoth = 0;
        let hasNeither = 0;
        let hasEither = 0;

        for (const node of allNodes) {
            const m = node.managerWallet && node.managerWallet !== "" && node.managerWallet !== "null"; // check "null" string too just in case
            const r = node.registrarWallet && node.registrarWallet !== "" && node.registrarWallet !== "null";

            if (m) hasManager++;
            if (r) hasRegistrar++;
            if (m && r) hasBoth++;
            if (!m && !r) hasNeither++;
            if (m || r) hasEither++;
        }

        console.log('\nResults (In-Memory Check):');
        console.log('----------------------------------------');
        console.log(`Total nodes: ${total}`);
        console.log(`Linked to at least one (Union): ${hasEither}`);
        console.log(`Unlinked (Neither): ${hasNeither}`);
        console.log(`Sum (Linked + Unlinked): ${hasEither + hasNeither}`);
        console.log('----------------------------------------');
        console.log(`Has Manager (Total): ${hasManager}`);
        console.log(`Has Registrar (Total): ${hasRegistrar}`);
        console.log('----------------------------------------');
        console.log(`Both: ${hasBoth}`);
        console.log(`Only Manager: ${hasManager - hasBoth}`);
        console.log(`Only Registrar: ${hasRegistrar - hasBoth}`);
        console.log('----------------------------------------');
        console.log(`Sanity Check: ${hasBoth} + ${hasManager - hasBoth} + ${hasRegistrar - hasBoth} + ${hasNeither} = ${hasBoth + (hasManager - hasBoth) + (hasRegistrar - hasBoth) + hasNeither}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
