
import { getAllNodes } from '../lib/server/mongodb-nodes';

async function checkManagers() {
    const nodes = await getAllNodes();
    const managerMap = new Map<string, Set<string>>();

    nodes.forEach(node => {
        const wallet = node.managerWallet || node.registrarWallet;
        if (!wallet) return;

        if (!managerMap.has(wallet)) {
            managerMap.set(wallet, new Set());
        }

        const network = node.network || 'unknown';
        managerMap.get(wallet)!.add(network);
    });

    console.log('Managers on multiple networks:');
    let multiCount = 0;
    managerMap.forEach((networks, wallet) => {
        if (networks.size > 1 || networks.has('both')) {
            console.log(`Manager ${wallet}: ${Array.from(networks).join(', ')}`);
            multiCount++;
        }
    });

    console.log(`Total managers with multi-network presence: ${multiCount}`);
    process.exit(0);
}

checkManagers().catch(console.error);
