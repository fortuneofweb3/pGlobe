/**
 * Helius-Powered Manager Wallet Discovery
 * 
 * Uses Helius API for better indexed transaction history.
 * Helius supports both Mainnet and Devnet.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_DEVNET_RPC = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

// Use Xandeum RPC for devnet data, Helius for Mainnet
const XANDEUM_DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

interface Mapping {
    nodeId: string;
    managerWallet: string;
    discoveredAt: string;
}

const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

async function heliusScan() {
    // Use Helius for Mainnet (faster) and Xandeum for Devnet (has the data)
    const heliusMainnet = new Connection(HELIUS_MAINNET_RPC, 'confirmed');
    const devnetConn = new Connection(XANDEUM_DEVNET_RPC, 'confirmed');

    // Also try Helius for Devnet
    const heliusDevnet = new Connection(HELIUS_DEVNET_RPC, 'confirmed');

    console.log('=== Using Helius APIs for faster indexing ===\n');

    // Get all Mainnet wallets
    console.log('Fetching Mainnet wallets (via Helius)...');
    const mainnetAccounts = await heliusMainnet.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Mainnet has ${mainnetWallets.size} wallets.\n`);

    // Get Devnet nodes from Xandeum
    console.log('Fetching Devnet nodes (via Xandeum)...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    // Try scanning the Devnet program via Helius (might have more history)
    console.log('Scanning Devnet Program via Helius...');

    const nodeToWallet = new Map<string, string>();
    let lastSig: string | undefined;
    let totalTxs = 0;
    let batchNum = 0;

    while (nodeToWallet.size < devnetNodes.size && batchNum < 100) {
        try {
            batchNum++;
            const sigs = await heliusDevnet.getSignaturesForAddress(
                DEVNET_PROGRAM,
                { limit: 1000, before: lastSig }
            );

            if (sigs.length === 0) {
                console.log('No more transactions to scan via Helius.');
                break;
            }

            totalTxs += sigs.length;
            lastSig = sigs[sigs.length - 1].signature;
            console.log(`Batch ${batchNum}: ${sigs.length} txs (total: ${totalTxs}, found: ${nodeToWallet.size})`);

            for (const sig of sigs) {
                try {
                    const tx = await heliusDevnet.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    const accountKeys = tx.transaction.message.accountKeys;
                    const signers = accountKeys.filter(a => a.signer);

                    for (const acc of accountKeys) {
                        const pubkey = acc.pubkey.toBase58();
                        if (devnetNodes.has(pubkey) && !nodeToWallet.has(pubkey)) {
                            for (const signer of signers) {
                                const signerPubkey = signer.pubkey.toBase58();
                                if (signerPubkey === pubkey) continue;
                                if (signerPubkey === DEVNET_PROGRAM.toBase58()) continue;
                                if (signerPubkey === '11111111111111111111111111111111') continue;

                                if (mainnetWallets.has(signerPubkey)) {
                                    nodeToWallet.set(pubkey, signerPubkey);
                                    console.log(`  ✅ ${pubkey.slice(0, 8)}... -> ${signerPubkey.slice(0, 8)}...`);
                                    break;
                                }
                            }
                        }
                    }
                } catch { }
            }

            // Small delay
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.error('Helius error:', e);
            break;
        }
    }

    // If Helius didn't have good Devnet history, let's try a different approach:
    // Check each node's first transaction to find who created it
    if (nodeToWallet.size < 50) {
        console.log('\n--- Trying node-by-node first transaction scan ---\n');

        let checked = 0;
        for (const nodeId of devnetNodes) {
            if (nodeToWallet.has(nodeId)) continue;
            checked++;

            if (checked % 20 === 0) {
                console.log(`  Progress: ${checked} nodes checked, ${nodeToWallet.size} found...`);
            }

            try {
                const nodePubkey = new PublicKey(nodeId);
                const sigs = await devnetConn.getSignaturesForAddress(nodePubkey, { limit: 10 });

                for (const sig of sigs) {
                    const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    const accountKeys = tx.transaction.message.accountKeys;
                    const signers = accountKeys.filter(a => a.signer);

                    for (const signer of signers) {
                        const signerPubkey = signer.pubkey.toBase58();
                        if (signerPubkey === nodeId) continue;
                        if (mainnetWallets.has(signerPubkey)) {
                            nodeToWallet.set(nodeId, signerPubkey);
                            console.log(`  ✅ ${nodeId.slice(0, 8)}... -> ${signerPubkey.slice(0, 8)}...`);
                            break;
                        }
                    }
                    if (nodeToWallet.has(nodeId)) break;
                }
            } catch { }

            // Rate limit
            await new Promise(r => setTimeout(r, 50));
        }
    }

    // Save results
    const mappings: Mapping[] = Array.from(nodeToWallet.entries()).map(([nodeId, managerWallet]) => ({
        nodeId,
        managerWallet,
        discoveredAt: new Date().toISOString()
    }));

    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Total nodes: ${devnetNodes.size}`);
    console.log(`Mappings discovered: ${nodeToWallet.size}`);
    console.log(`Coverage: ${Math.round(nodeToWallet.size / devnetNodes.size * 100)}%`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

heliusScan().catch(console.error);
