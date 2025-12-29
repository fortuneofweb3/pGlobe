import { Connection, PublicKey } from '@solana/web3.js';
import { getAllNodes, updateNode } from '../lib/server/mongodb-nodes';
import { enrichPNodeWithOnChainData } from '../lib/server/solana-pnodes';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function backfill() {
    console.log('[Backfill] Starting wallet backfill for registered nodes...');
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    try {
        const nodes = await getAllNodes();
        const registeredMissingInfo = nodes.filter(n =>
            n.isRegistered && (!n.managerWallet || !n.registrarWallet)
        );

        console.log(`[Backfill] Found ${registeredMissingInfo.length} registered nodes missing wallet info.`);

        for (const node of registeredMissingInfo) {
            const pubkey = node.pubkey || node.publicKey;
            if (!pubkey) continue;

            console.log(`[Backfill] Processing ${pubkey}...`);
            try {
                const onChain = await enrichPNodeWithOnChainData(pubkey, connection);

                const updates: any = {};
                if (onChain.managerWallet && onChain.managerWallet !== node.managerWallet) {
                    updates.managerWallet = onChain.managerWallet;
                }
                if (onChain.registrarWallet && onChain.registrarWallet !== node.registrarWallet) {
                    updates.registrarWallet = onChain.registrarWallet;
                }

                if (Object.keys(updates).length > 0) {
                    console.log(`[Backfill] Updating ${pubkey}:`, updates);
                    await updateNode(pubkey, updates);
                } else {
                    console.log(`[Backfill] No new info found for ${pubkey}`);
                }
            } catch (err) {
                console.error(`[Backfill] Failed to process ${pubkey}:`, err);
            }
        }

        console.log('[Backfill] Done!');
    } catch (err) {
        console.error('[Backfill] Fatal error:', err);
    }
}

backfill();
