import dotenv from 'dotenv';
dotenv.config();

import { getAllNodes } from '../lib/server/mongodb-nodes';

async function test() {
    const nodes = await getAllNodes();

    const registered = nodes.filter(n => n.isRegistered);
    const unregistered = nodes.filter(n => !n.isRegistered);

    console.log('Total nodes:', nodes.length);
    console.log('Registered nodes:', registered.length);
    console.log('Unregistered nodes:', unregistered.length);

    // Check for registered nodes missing wallet info
    const missingWallet = registered.filter(n => !n.managerWallet || !n.registrarWallet);
    console.log('\nRegistered nodes missing wallet info:', missingWallet.length);

    // Check for unregistered nodes - these are the ones getting refreshed
    console.log('\nUnregistered nodes (first 10):');
    unregistered.slice(0, 10).forEach(n => {
        const pk = n.pubkey || n.publicKey;
        console.log('  PK:', pk?.slice(0, 12), 'Balance:', n.balance, 'isRegistered:', n.isRegistered);
    });

    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
