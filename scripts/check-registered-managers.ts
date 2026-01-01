import 'dotenv/config';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function checkManagers() {
    console.log('--- Registered Nodes Manager Analysis ---');
    const collection = await getNodesCollection();

    // 1. Get all registered nodes
    const registeredNodes = await collection.find({ isRegistered: true }).toArray();
    const total = registeredNodes.length;
    console.log(`Total Registered Nodes in DB: ${total}`);

    if (total === 0) {
        console.log('No registered nodes found.');
        process.exit(0);
    }

    // 2. Classify nodes
    const withBuyer = registeredNodes.filter(n => n.managerWallet);
    const withRegistrarOnly = registeredNodes.filter(n => !n.managerWallet && n.registrarWallet);
    const missingBoth = registeredNodes.filter(n => !n.managerWallet && !n.registrarWallet);

    console.log(`\nResults:`);
    console.log(`✅ Nodes with Manager Wallet (Buyer): ${withBuyer.length} (${((withBuyer.length / total) * 100).toFixed(1)}%)`);
    console.log(`ℹ️  Nodes with Registrar Wallet only:   ${withRegistrarOnly.length} (${((withRegistrarOnly.length / total) * 100).toFixed(1)}%)`);
    console.log(`❌ Nodes MISSING BOTH:                ${missingBoth.length} (${((missingBoth.length / total) * 100).toFixed(1)}%)`);

    if (missingBoth.length > 0) {
        console.log('\n--- Missing Manager Info for: ---');
        missingBoth.forEach(n => {
            console.log(`- ${n.pubkey || n.publicKey} (Status: ${n.status})`);
        });
        console.log('\nNote: These nodes are marked as registered but no manager or registrar wallet was found during sync.');
    }

    // 3. Check for specific discrepancies
    const unregisteredMissingWallets = await collection.countDocuments({
        isRegistered: false,
        $or: [
            { managerWallet: { $exists: true, $ne: null } },
            { registrarWallet: { $exists: true, $ne: null } }
        ]
    });

    if (unregisteredMissingWallets > 0) {
        console.log(`\n⚠️  Found ${unregisteredMissingWallets} nodes marked as UNREGISTERED but having associated wallets.`);
    }

    process.exit(0);
}

checkManagers().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
