/**
 * Investigate credits discrepancy - why 89 v1.2 nodes but only 14 have credits
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function main() {
    const db = await getNodesCollection();

    // Fetch mainnet credits API
    const creditsResp = await fetch('https://podcredits.xandeum.network/api/pods-credits');
    const creditsData = await creditsResp.json();
    const creditPodIds = new Set(creditsData.pods_credits.map((p: any) => p.pod_id));

    console.log('=== MAINNET CREDITS API ===');
    console.log('Pods in mainnet credits API:', creditPodIds.size);

    // Get nodes from DB
    const allNodes = await db.find({}).toArray();
    console.log('Total nodes in DB:', allNodes.length);

    // Check v1.2 nodes
    const v12Nodes = allNodes.filter(n => n.version?.startsWith('1.2'));
    console.log('v1.2.x nodes in DB:', v12Nodes.length);

    // How many v1.2 nodes have credits from API?
    const v12WithCredits = v12Nodes.filter(n => creditPodIds.has(n.pubkey));
    console.log('v1.2 nodes matching mainnet credits API:', v12WithCredits.length);

    // How many credit API pods are in our DB?
    const creditPodsInDB = creditsData.pods_credits.filter((p: any) =>
        allNodes.some(n => n.pubkey === p.pod_id)
    );
    console.log('Credit API pods found in our DB:', creditPodsInDB.length);

    // List credit API pods and their status
    console.log('\n=== MAINNET CREDITS PODS STATUS ===');
    for (const pod of creditsData.pods_credits) {
        const node = allNodes.find(n => n.pubkey === pod.pod_id);
        if (node) {
            console.log(`  ${pod.pod_id.slice(0, 12)}... | v${node.version || '?'} | ${node.status} | Credits: ${pod.credits}`);
        } else {
            console.log(`  ${pod.pod_id.slice(0, 12)}... | NOT IN DB | Credits: ${pod.credits}`);
        }
    }

    // Show v1.2 nodes NOT in credits API (first 15)
    console.log('\n=== V1.2 NODES WITHOUT MAINNET CREDITS (sample) ===');
    const v12NoCredits = v12Nodes.filter(n => !creditPodIds.has(n.pubkey)).slice(0, 15);
    for (const node of v12NoCredits) {
        console.log(`  ${node.pubkey?.slice(0, 12)}... | v${node.version} | ${node.status} | DB credits: ${node.credits ?? 'none'}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
