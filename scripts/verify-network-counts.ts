
import { getNodesCollection } from '../lib/server/mongodb-nodes';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function verify() {
    try {
        const collection = await getNodesCollection();
        const mainnetCount = await collection.countDocuments({ network: 'mainnet' });
        const devnetCount = await collection.countDocuments({ network: 'devnet' });
        const unknownCount = await collection.countDocuments({ network: 'unknown' });
        const bothCount = await collection.countDocuments({ network: 'both' });
        const total = await collection.countDocuments({});

        console.log('--- Network Tally ---');
        console.log(`Mainnet: ${mainnetCount}`);
        console.log(`Devnet:  ${devnetCount}`);
        console.log(`Both:    ${bothCount}`);
        console.log(`Unknown: ${unknownCount}`);
        console.log(`Total:   ${total}`);

        process.exit(0);
    } catch (error) {
        console.error('Verify failed:', error);
        process.exit(1);
    }
}

verify();
