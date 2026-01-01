
import { Connection } from '@solana/web3.js';
import { getAllNodes, updateNode } from '../lib/server/mongodb-nodes';
import { enrichPNodeWithOnChainData, DEVNET_RPC } from '../lib/server/solana-pnodes';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = DEVNET_RPC;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refetchOnChainMetadata() {
    console.log('Starting on-chain metadata refetch...');
    console.log('Using RPC URL:', RPC_URL);

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
        // 1. Fetch all nodes from DB
        console.log('Fetching all nodes from database...');
        const allNodes = await getAllNodes();
        console.log(`Found ${allNodes.length} nodes to process.`);

        let processed = 0;
        let updated = 0;
        let errors = 0;

        // 2. Process each node
        for (const node of allNodes) {
            const pubkey = node.pubkey || node.publicKey || node.id;

            if (!pubkey) {
                console.warn(`Node missing pubkey: ${JSON.stringify(node)}`);
                continue;
            }

            console.log(`[${processed + 1}/${allNodes.length}] Fetching on-chain data for ${pubkey}...`);

            try {
                // 3. Enrich with on-chain data with retries
                let enrichedData = null;
                let retries = 3;
                while (retries > 0) {
                    try {
                        // Pass current version to help with cluster selection in enrichPNodeWithOnChainData
                        enrichedData = await enrichPNodeWithOnChainData(pubkey, connection, node.version);
                        break;
                    } catch (err: any) {
                        if (err.message && err.message.includes('429')) {
                            console.log(`  > 429 Rate Limit. Waiting 5s... (Retries left: ${retries})`);
                            await sleep(5000);
                            retries--;
                        } else {
                            throw err;
                        }
                    }
                }

                if (!enrichedData || enrichedData.error) {
                    console.warn(`  > Failed to fetch data: ${enrichedData?.error || 'Unknown error'}`);
                    errors++;
                    continue;
                }

                // 4. Build updates
                const updates: any = {};

                // Fields to update from on-chain data
                if (enrichedData.isRegistered !== undefined) updates.isRegistered = enrichedData.isRegistered;
                if (enrichedData.managerWallet) updates.managerWallet = enrichedData.managerWallet;
                if (enrichedData.registrarWallet) updates.registrarWallet = enrichedData.registrarWallet;
                if (enrichedData.eraLabel) updates.eraLabel = enrichedData.eraLabel;
                if (enrichedData.eraBoost) updates.eraBoost = enrichedData.eraBoost;
                if (enrichedData.nftBoost) updates.nftBoost = enrichedData.nftBoost;
                if (enrichedData.xandStake !== undefined) updates.xandStake = enrichedData.xandStake;

                // Calculate boost factor
                const nftMultiplier = enrichedData.nftBoost || 1;
                const eraMultiplier = enrichedData.eraBoost || 1;
                updates.boostFactor = nftMultiplier * eraMultiplier;

                // 5. Update DB if changes detected
                if (Object.keys(updates).length > 0) {
                    await updateNode(pubkey, updates);
                    updated++;
                    console.log(`  > ✅ Updated: Registered=${updates.isRegistered}, Manager=${updates.managerWallet?.slice(0, 8) || 'NONE'}`);
                }

                processed++;
            } catch (err) {
                console.error(`  ❌ Failed to process ${pubkey}:`, err);
                errors++;
            }

            // Small delay to be kind to the RPC
            await sleep(200);
        }

        console.log('\n--- Refetch Complete ---');
        console.log(`Total Processed: ${processed}`);
        console.log(`Updated: ${updated}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);
    } catch (err) {
        console.error('Fatal error during refetch:', err);
        process.exit(1);
    }
}

refetchOnChainMetadata();
