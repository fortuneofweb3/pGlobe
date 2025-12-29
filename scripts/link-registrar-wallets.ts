/**
 * Link All Nodes to Their Registrar Wallets
 * 
 * For each Devnet node, scan its transaction history to find the wallet
 * that signed the registration transaction. This links nodes to their
 * registrar (the person who set up the node on Devnet).
 * 
 * Also adds buyerWallet field for nodes where we can match.
 */

import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

interface NodeWalletInfo {
    nodeId: string;
    registrarWallet: string | null;
    foundAt: string;
}

async function linkAllNodes() {
    const conn = new Connection(DEVNET_RPC, 'confirmed');

    // Get all Devnet nodes
    console.log('Fetching Devnet nodes...');
    const indexInfo = await conn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes: string[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.push(key.toBase58());
        }
    }
    console.log(`Found ${devnetNodes.length} nodes.\n`);

    // Scan each node's transactions
    console.log('Scanning node transactions to find registrar wallets...\n');
    const results: NodeWalletInfo[] = [];
    let found = 0;
    let checked = 0;

    for (const nodeId of devnetNodes) {
        checked++;
        if (checked % 25 === 0) {
            console.log(`  Progress: ${checked}/${devnetNodes.length} checked, ${found} found...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);

            // Get all transactions for this node
            const sigs = await conn.getSignaturesForAddress(nodePubkey, { limit: 20 });

            let registrarWallet: string | null = null;

            for (const sig of sigs) {
                try {
                    const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    // Check if this transaction involves the Devnet Program
                    const involvesProgram = tx.transaction.message.accountKeys.some(
                        a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                    );
                    if (!involvesProgram) continue;

                    // Find signers that aren't the node itself
                    const signers = tx.transaction.message.accountKeys.filter(a => a.signer);
                    for (const signer of signers) {
                        const signerKey = signer.pubkey.toBase58();
                        // Skip the node itself and system program
                        if (signerKey === nodeId) continue;
                        if (signerKey === '11111111111111111111111111111111') continue;
                        if (signerKey === DEVNET_PROGRAM.toBase58()) continue;

                        // This is likely the registrar
                        registrarWallet = signerKey;
                        break;
                    }

                    if (registrarWallet) break;
                } catch { }
            }

            if (registrarWallet) {
                results.push({
                    nodeId,
                    registrarWallet,
                    foundAt: new Date().toISOString()
                });
                found++;
                console.log(`    ✅ ${nodeId.slice(0, 8)}... -> ${registrarWallet.slice(0, 8)}...`);
            }
        } catch (err) {
            // Node might not have any transactions or RPC error
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 50));
    }

    // Update MongoDB with registrar wallets
    console.log(`\n\nUpdating MongoDB with ${results.length} registrar wallets...`);
    const collection = await getNodesCollection();

    let updated = 0;
    let skipped = 0;

    for (const result of results) {
        try {
            const updateResult = await collection.updateOne(
                { _id: result.nodeId },
                { $set: { registrarWallet: result.registrarWallet } }
            );

            if (updateResult.matchedCount > 0) {
                updated++;
            } else {
                skipped++;
            }
        } catch { }
    }

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Nodes checked: ${checked}`);
    console.log(`Registrar wallets found: ${found}`);
    console.log(`Updated in MongoDB: ${updated}`);
    console.log(`Skipped (not in DB): ${skipped}`);

    process.exit(0);
}

linkAllNodes().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
