
import { Connection } from '@solana/web3.js';
import { getAllNodes, upsertNodes, NodeDocument } from '../lib/server/mongodb-nodes';
import { enrichPNodeWithOnChainData } from '../lib/server/solana-pnodes';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillNodes() {
    console.log('Starting node data backfill...');
    console.log('RPC URL:', RPC_URL);

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
        // 1. Fetch all nodes from DB
        console.log('Fetching all nodes from database...');
        const allNodes = await getAllNodes();
        const nodes = allNodes.filter(n => n.isRegistered);
        console.log(`Found ${allNodes.length} total nodes.`);
        console.log(`Processing ${nodes.length} REGISTERED nodes.`);

        let processed = 0;
        let errors = 0;

        // 2. Process each node
        for (const node of nodes) {
            const pubkey = node.pubkey || node.publicKey || node.id;

            if (!pubkey) {
                console.warn(`Node missing pubkey: ${JSON.stringify(node)}`);
                continue;
            }

            console.log(`[${processed + 1}/${nodes.length}] Processing ${pubkey}...`);

            try {
                // 3. Enrich with on-chain data with retries
                let enrichedData = null;
                let retries = 3;
                while (retries > 0) {
                    try {
                        enrichedData = await enrichPNodeWithOnChainData(pubkey, connection);
                        break;
                    } catch (err: any) {
                        if (err.message && err.message.includes('429')) {
                            console.log(`  > 429 Rate Limit. Waiting 2s... (Retries left: ${retries})`);
                            await sleep(2000);
                            retries--;
                        } else {
                            throw err;
                        }
                    }
                }

                if (!enrichedData) {
                    console.warn(`  > Failed to fetch data after retries.`);
                    errors++;
                    continue;
                }

                // Safety Check: If DB says Registered, but OnChain says NOT, it's likely a silent RPC failure (null return).
                // Do NOT overwrite with "Standard". Throw to trigger retry or skip.
                if (node.isRegistered && !enrichedData.isRegistered) {
                    console.warn(`  > Result mismatch (Expected Registered). RPC likely returned null. Retrying...`);
                    // Throwing here will be caught by the retry loop?
                    // No, "enrichedData" is returned by catch block of try loop.
                    // The retry loop wraps the enrich call. This check is OUTSIDE.
                    // We need to move this check INSIDE the retry loop or force a retry here.

                    // Actually, just throwing here won't work easily because we are outside the retry loop.
                    // Let's modify the retry loop logic instead?
                    // But simpler: just SKIP the update to avoid corrupting data.
                    console.warn(`  > SKIPPING update for ${pubkey} to avoid overwriting with 'Standard'.`);
                    errors++;
                    continue;
                }

                if (enrichedData.error) {
                    console.warn(`  Stats fetch error: ${enrichedData.error}`);
                }

                // 4. Update node object
                if (enrichedData.xandStake !== undefined) node.xandStake = enrichedData.xandStake;
                if (enrichedData.eraLabel) node.eraLabel = enrichedData.eraLabel;
                if (enrichedData.eraBoost) node.eraBoost = enrichedData.eraBoost;
                if (enrichedData.nftBoost) node.nftBoost = enrichedData.nftBoost;
                if (enrichedData.nftDetails) node.nftDetails = enrichedData.nftDetails;

                // Calculate combined boost if relevant
                const nftMultiplier = node.nftBoost || 1;
                const eraMultiplier = node.eraBoost || 1;
                node.boostFactor = nftMultiplier * eraMultiplier;

                // 5. Upsert back to DB using upsertNodes (plural)
                await upsertNodes([node]);

                if (Array.isArray(node.nftDetails) && node.nftDetails.length > 0) {
                    console.log(`  > Updated: Era=${node.eraLabel}, Stake=${node.xandStake}, NFTs=${node.nftDetails.length}`);
                } else if (node.xandStake > 0) {
                    console.log(`  > Updated: Era=${node.eraLabel}, Stake=${node.xandStake}`);
                } else {
                    console.log(`  > Updated: Era=${node.eraLabel}`);
                }

                processed++;
            } catch (err) {
                console.error(`  Failed to process ${pubkey}:`, err);
                errors++;
            }

            // Delay between nodes to respect rate limits
            await sleep(500);
        }

        console.log('Backfill complete!');
        console.log(`Processed: ${processed}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);
    } catch (err) {
        console.error('Fatal error during backfill:', err);
        process.exit(1);
    }
}

backfillNodes();
