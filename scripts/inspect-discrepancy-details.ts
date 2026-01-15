
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    console.log('Inspecting discrepancies for 1kbN95... and 5v22...');
    const db = await getDb();

    const wallets = [
        '1kbN95whs6ANM4DCpM65BugzWYczsSvrEKnCbAbJCsT',
        '5v22cdd6wwYA6F2VLsjt9pW9heWx6gcqnyRYmXmzqA84'
    ];

    const nodes = await db.collection('nodes').find({
        managerWallet: { $in: wallets }
    }).toArray();

    for (const w of wallets) {
        console.log(`\nManager: ${w}`);
        const managersNodes = nodes.filter(n => n.managerWallet === w);
        managersNodes.forEach(n => {
            console.log(`  - Node: ${n.pubkey || n.publicKey}`);
            console.log(`    Network: ${n.network}`);
            console.log(`    Status: ${n.status}`);
            console.log(`    Manager: ${n.managerWallet}`);
            console.log(`    Registrar: ${n.registrarWallet}`);
        });
    }

    process.exit(0);
}

main().catch(console.error);
