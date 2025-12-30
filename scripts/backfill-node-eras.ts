
import { Connection } from '@solana/web3.js';
import { getAllNodes, upsertNodes } from '../lib/server/mongodb-nodes';
import { enrichPNodeWithOnChainData } from '../lib/server/solana-pnodes';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillEras() {
    console.log('Starting node era backfill...');
    console.log('RPC URL:', RPC_URL);

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
        // 1. Fetch all nodes from DB
        console.log('Fetching all nodes from database...');
        const allNodes = await getAllNodes();
        // Filter for registered nodes or nodes that need era update
        const nodes = allNodes.filter(n => n.isRegistered || (n.balance && n.balance > 0));

        console.log(`Found ${allNodes.length} total nodes.`);
        console.log(`Processing ${nodes.length} nodes for era enrichment.`);

        let updated = 0;
        let errors = 0;
        let skipped = 0;

        // 2. Process each node
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const pubkey = node.pubkey || node.publicKey || node.id;

            if (!pubkey) continue;

            console.log(`[${i + 1}/${nodes.length}] ${pubkey.slice(0, 8)}... `);

            try {
                // 3. Enrich with on-chain data (with basic retry for 429s)
                let onChain: any = null;
                let retries = 5;
                while (retries > 0) {
                    try {
                        onChain = await enrichPNodeWithOnChainData(pubkey, connection);
                        break;
                    } catch (err: any) {
                        if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
                            const delay = (6 - retries) * 2000;
                            console.log(`  > 429 Rate Limit. Waiting ${delay}ms...`);
                            await sleep(delay);
                            retries--;
                        } else {
                            throw err;
                        }
                    }
                }

                if (!onChain || onChain.error) {
                    console.log(`  > Error: ${onChain?.error || 'Unknown error'}`);
                    errors++;
                    continue;
                }

                // Check era info
                const oldEra = node.eraLabel;
                const newEra = onChain.eraLabel;
                const price = onChain.balance || 0; // Balance is used as price in solana-pnodes enrichment return? 
                // Wait, solana-pnodes returns 'balance' for SOL balance.
                // It doesn't return purchasePriceSOL.
                // But it updates eraLabel and eraBoost internally.

                if (newEra && (newEra !== oldEra || oldEra === 'Standard' || (oldEra?.includes('South') && !oldEra?.includes('Deep')))) {
                    // Update node fields
                    node.eraLabel = newEra;
                    node.eraBoost = onChain.eraBoost;
                    node.nftBoost = onChain.nftBoost;
                    node.nftDetails = onChain.nftDetails;
                    node.xandStake = onChain.xandStake;
                    node.managerWallet = onChain.managerWallet;
                    node.registrarWallet = onChain.registrarWallet;

                    // Re-calculate boost factor
                    const nftMult = onChain.nftBoost || 1;
                    const eraMult = onChain.eraBoost || 1;
                    node.boostFactor = nftMult * eraMult;

                    // Save back to DB
                    await upsertNodes([node], true);
                    console.log(`  > UPDATED: ${oldEra || 'None'} -> ${newEra}`);
                    updated++;
                } else {
                    console.log(`  > No change (${newEra || 'Standard'})`);
                    skipped++;
                }
            } catch (err: any) {
                console.error(`  > Failed: ${err.message}`);
                errors++;
            }

            // Rapid fire with Helius
            await sleep(10);
        }

        console.log('\n--- Backfill Summary ---');
        console.log(`Total Processed: ${nodes.length}`);
        console.log(`Successfully Updated: ${updated}`);
        console.log(`Skipped (No Change): ${skipped}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);
    } catch (err) {
        console.error('Fatal error during backfill:', err);
        process.exit(1);
    }
}

backfillEras();
