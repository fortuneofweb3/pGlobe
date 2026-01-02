
import { config } from 'dotenv';
import { getManagerStatsCollection } from '../lib/server/mongodb-nodes';

// Load environment variables
config({ path: '.env.local' });
config();

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        const collection = await getManagerStatsCollection();

        const count = await collection.countDocuments({});
        console.log(`Total documents in 'manager_stats': ${count}`);

        const wallets = [
            '3E1MAZzMV69yXwtZFy9cSTSByVMXGCSasitCNtRX5UxT', // Expected: 4
            'sHokok1QWtQePa9vHeA5dXzB2PrFaPfxzth6s2hvXwa'   // Expected: 2 (despite 0 registered)
        ];

        console.log('Checking specific wallets:');
        const docs = await collection.find({ wallet: { $in: wallets } }).toArray();
        console.log(JSON.stringify(docs, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
