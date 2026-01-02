/**
 * Deep dive: Understand how mainnet vs devnet credits work
 * - Are pods exclusive to one network?
 * - Can a pod be on both?
 * - What's the overlap?
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function main() {
    const db = await getNodesCollection();

    // Fetch both APIs
    const [mainnetResp, devnetResp] = await Promise.all([
        fetch('https://podcredits.xandeum.network/api/pods-credits'),
        fetch('https://podcredits.xandeum.network/api/devnet-pod-credits')
    ]);

    const mainnetData = await mainnetResp.json();
    const devnetData = await devnetResp.json();

    const mainnetPods = new Map(mainnetData.pods_credits.map((p: any) => [p.pod_id, p.credits]));
    const devnetPods = new Map(devnetData.pods_credits.map((p: any) => [p.pod_id, p.credits]));

    console.log('=== API OVERVIEW ===');
    console.log('Mainnet API pods:', mainnetPods.size);
    console.log('Devnet API pods:', devnetPods.size);

    // Check overlap
    const overlap: string[] = [];
    for (const podId of mainnetPods.keys()) {
        if (devnetPods.has(podId)) {
            overlap.push(podId);
        }
    }

    console.log('\n=== OVERLAP (pods in BOTH APIs) ===');
    console.log('Pods appearing in BOTH APIs:', overlap.length);

    if (overlap.length > 0) {
        console.log('\nThese pods have credits on BOTH networks:');
        for (const podId of overlap) {
            console.log(`  ${podId.slice(0, 16)}... | Mainnet: ${mainnetPods.get(podId)} | Devnet: ${devnetPods.get(podId)}`);
        }
    }

    // Get our DB nodes
    const allNodes = await db.find({}).toArray();

    console.log('\n=== OUR DB NODES ANALYSIS ===');
    console.log('Total nodes in DB:', allNodes.length);

    // Categorize our nodes
    let mainnetOnly = 0;
    let devnetOnly = 0;
    let both = 0;
    let neither = 0;

    const mainnetNodes: any[] = [];
    const devnetNodes: any[] = [];

    for (const node of allNodes) {
        const inMainnet = mainnetPods.has(node.pubkey);
        const inDevnet = devnetPods.has(node.pubkey);

        if (inMainnet && inDevnet) {
            both++;
            mainnetNodes.push({ ...node, network: 'both' });
        } else if (inMainnet) {
            mainnetOnly++;
            mainnetNodes.push({ ...node, network: 'mainnet' });
        } else if (inDevnet) {
            devnetOnly++;
            devnetNodes.push({ ...node, network: 'devnet' });
        } else {
            neither++;
        }
    }

    console.log(`\nMainnet only: ${mainnetOnly}`);
    console.log(`Devnet only: ${devnetOnly}`);
    console.log(`Both networks: ${both}`);
    console.log(`Neither (no credits): ${neither}`);

    // Show mainnet nodes
    console.log('\n=== MAINNET NODES (our DB) ===');
    for (const node of mainnetNodes) {
        const mainnetCredits = mainnetPods.get(node.pubkey) || 0;
        const devnetCredits = devnetPods.get(node.pubkey) || 0;
        console.log(`  ${node.pubkey?.slice(0, 16)}... | v${node.version} | ${node.status} | Mainnet: ${mainnetCredits} | Devnet: ${devnetCredits || 'N/A'}`);
    }

    // Show sample devnet nodes
    console.log('\n=== DEVNET NODES (sample from our DB) ===');
    for (const node of devnetNodes.slice(0, 10)) {
        const devnetCredits = devnetPods.get(node.pubkey) || 0;
        console.log(`  ${node.pubkey?.slice(0, 16)}... | v${node.version} | ${node.status} | Devnet credits: ${devnetCredits}`);
    }

    // Version breakdown by network
    console.log('\n=== VERSION BREAKDOWN BY NETWORK ===');
    const mainnetVersions: Record<string, number> = {};
    const devnetVersions: Record<string, number> = {};

    for (const node of mainnetNodes) {
        const v = node.version || 'unknown';
        mainnetVersions[v] = (mainnetVersions[v] || 0) + 1;
    }
    for (const node of devnetNodes) {
        const v = node.version || 'unknown';
        devnetVersions[v] = (devnetVersions[v] || 0) + 1;
    }

    console.log('Mainnet versions:', mainnetVersions);
    console.log('Devnet versions:', devnetVersions);

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
