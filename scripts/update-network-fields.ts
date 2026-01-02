/**
 * Quick script to ONLY update credits and network fields (skip full sync)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getNodesCollection } from '../lib/server/mongodb-nodes';

const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';
const DEVNET_POD_CREDITS_API = 'https://podcredits.xandeum.network/api/devnet-pod-credits';

async function main() {
    console.log('Fetching credits from both APIs...');

    const [mainnetResp, devnetResp] = await Promise.all([
        fetch(POD_CREDITS_API).then(r => r.json()),
        fetch(DEVNET_POD_CREDITS_API).then(r => r.json())
    ]);

    const mainnetPods = new Map<string, number>();
    const devnetPods = new Map<string, number>();

    if (mainnetResp.status === 'success') {
        for (const pod of mainnetResp.pods_credits || []) {
            mainnetPods.set(pod.pod_id, pod.credits);
        }
    }
    console.log(`Mainnet: ${mainnetPods.size} pods`);

    if (devnetResp.status === 'success') {
        for (const pod of devnetResp.pods_credits || []) {
            devnetPods.set(pod.pod_id, pod.credits);
        }
    }
    console.log(`Devnet: ${devnetPods.size} pods`);

    // Update database
    const db = await getNodesCollection();
    const nodes = await db.find({}).toArray();
    console.log(`Updating ${nodes.length} nodes...`);

    let mainnetCount = 0, devnetCount = 0, bothCount = 0, unknownCount = 0;

    for (const node of nodes) {
        const pubkey = node.pubkey || node.publicKey;
        if (!pubkey) continue;

        const mainnetCredits = mainnetPods.get(pubkey);
        const devnetCredits = devnetPods.get(pubkey);

        const inMainnet = mainnetCredits !== undefined;
        const inDevnet = devnetCredits !== undefined;

        let network: string;
        if (inMainnet && inDevnet) {
            network = 'both';
            bothCount++;
        } else if (inMainnet) {
            network = 'mainnet';
            mainnetCount++;
        } else if (inDevnet) {
            network = 'devnet';
            devnetCount++;
        } else {
            network = 'unknown';
            unknownCount++;
        }

        // Update the node
        await db.updateOne(
            { pubkey },
            {
                $set: {
                    network,
                    mainnetCredits: mainnetCredits ?? null,
                    devnetCredits: devnetCredits ?? null,
                    credits: mainnetCredits ?? devnetCredits ?? node.credits,
                    creditsResetMonth: new Date().toISOString().slice(0, 7),
                }
            }
        );
    }

    console.log('\n=== RESULT ===');
    console.log(`Mainnet only: ${mainnetCount}`);
    console.log(`Devnet only: ${devnetCount}`);
    console.log(`Both: ${bothCount}`);
    console.log(`Unknown: ${unknownCount}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
