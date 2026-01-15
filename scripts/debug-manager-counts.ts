
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { aggregateManagers } from '../lib/server/stats-helpers';

async function main() {
    console.log('Scanning for managers with Registered > Purchased...');
    const { managers } = await aggregateManagers('all');

    const discrepancies = managers.filter(m => m.registeredNodes > (m.totalPurchases || 0));

    console.log(`Found ${discrepancies.length} managers with discrepancies:`);
    for (const m of discrepancies) {
        console.log(`\nManager: ${m.wallet}`);
        console.log(`  Registered (DB): ${m.registeredNodes}`);
        console.log(`  Purchased (On-Chain/DB): ${m.totalPurchases} (Total) / ${m.purchasedNodes} (Computed)`);
        console.log(`  Nodes:`);
        m.knownNodes.forEach(n => {
            console.log(`    - ${n.pubkey} (Role: ${n.role})`);
        });
    }
    process.exit(0);
}

main().catch(console.error);
