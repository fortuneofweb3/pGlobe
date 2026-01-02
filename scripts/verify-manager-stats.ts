
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

        if (count > 0) {
            console.log('Sample documents (first 5):');
            const docs = await collection.find({}).limit(5).toArray();
            console.log(JSON.stringify(docs, null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
