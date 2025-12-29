import 'dotenv/config';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function analyzeOverlap() {
    const collection = await getNodesCollection();
    const nodes = await collection.find({
        managerWallet: { $exists: true }, // Has Buyer
        registrarWallet: { $exists: true } // Has Registrar
    }).toArray();

    const registrarToBuyers = new Map<string, Set<string>>();

    for (const node of nodes) {
        if (node.managerWallet === node.registrarWallet) continue; // Same wallet, auto-merged

        if (!registrarToBuyers.has(node.registrarWallet)) {
            registrarToBuyers.set(node.registrarWallet, new Set());
        }
        registrarToBuyers.get(node.registrarWallet)!.add(node.managerWallet);
    }

    console.log(`Analyzed ${nodes.length} nodes with both wallets.`);
    console.log(`Found ${registrarToBuyers.size} distinct Registrar wallets linked to different Buyers.`);

    let multiBuyerRegistrars = 0;

    registrarToBuyers.forEach((buyers, registrar) => {
        if (buyers.size > 1) {
            multiBuyerRegistrars++;
            console.log(`⚠️ Registrar ${registrar} maps to ${buyers.size} different Buyers: ${Array.from(buyers).join(', ')}`);
        } else {
            console.log(`✅ Registrar ${registrar} maps to single Buyer: ${Array.from(buyers)[0]}`);
        }
    });

    if (multiBuyerRegistrars === 0) {
        console.log('\nCONCLUSION: Safe to merge! All Registrars map to a unique Buyer.');
    } else {
        console.log('\nCONCLUSION: Conflict! Some Registrars are shared between Buyers.');
    }

    process.exit(0);
}

analyzeOverlap();
