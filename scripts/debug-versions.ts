
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    console.log('Inspecting versions for 1kbN95...');
    const db = await getDb();

    const nodes = await db.collection('nodes').find({
        managerWallet: '1kbN95whs6ANM4DCpM65BugzWYczsSvrEKnCbAbJCsT'
    }).toArray();

    nodes.forEach(n => {
        console.log(`- Node: ${n.pubkey}`);
        console.log(`  Version: ${n.version}`);
        console.log(`  Era: ${n.eraLabel}`);
        console.log(`  Created: ${n.createdAt}`);
    });
    process.exit(0);
}

main().catch(console.error);
