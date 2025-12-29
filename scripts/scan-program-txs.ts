/**
 * Scan Devnet Program Transaction History
 * 
 * Since wallets don't have Devnet tx history, scan the PROGRAM's transactions
 * and for each registerPNode transaction, find:
 * - Which node was registered
 * - Which wallet signed (the Manager Wallet)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

interface Mapping {
    nodeId: string;
    managerWallet: string;
    discoveredAt: string;
}

const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

async function scanProgramTransactions() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get all Mainnet wallets for validation
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Mainnet has ${mainnetWallets.size} wallets.\n`);

    // Get Devnet nodes
    console.log('Fetching Devnet nodes...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    // Scan the Devnet Program's transaction history
    console.log('Scanning Devnet Program transactions...\n');
    const nodeToWallet = new Map<string, string>();
    let lastSig: string | undefined;
    let totalTxs = 0;
    let registrationTxs = 0;

    while (nodeToWallet.size < devnetNodes.size) {
        try {
            const sigs = await devnetConn.getSignaturesForAddress(
                DEVNET_PROGRAM,
                { limit: 1000, before: lastSig }
            );

            if (sigs.length === 0) {
                console.log('No more transactions to scan.');
                break;
            }

            totalTxs += sigs.length;
            lastSig = sigs[sigs.length - 1].signature;
            console.log(`Processing batch... (total: ${totalTxs} txs, found: ${nodeToWallet.size} mappings)`);

            for (const sig of sigs) {
                try {
                    const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    // Find if this tx involves a node
                    const accountKeys = tx.transaction.message.accountKeys;
                    const signers = accountKeys.filter(a => a.signer);

                    for (const acc of accountKeys) {
                        const pubkey = acc.pubkey.toBase58();
                        if (devnetNodes.has(pubkey) && !nodeToWallet.has(pubkey)) {
                            // This tx involves a node - find the non-node signer
                            for (const signer of signers) {
                                const signerPubkey = signer.pubkey.toBase58();
                                // Skip if signer is the node itself
                                if (signerPubkey === pubkey) continue;
                                // Skip if signer is the program or system program
                                if (signerPubkey === DEVNET_PROGRAM.toBase58()) continue;
                                if (signerPubkey === '11111111111111111111111111111111') continue;

                                // Check if this signer is a Mainnet wallet
                                if (mainnetWallets.has(signerPubkey)) {
                                    nodeToWallet.set(pubkey, signerPubkey);
                                    registrationTxs++;
                                    console.log(`  ✅ ${pubkey.slice(0, 8)}... -> ${signerPubkey.slice(0, 8)}...`);
                                    break;
                                }
                            }
                        }
                    }
                } catch { }
            }

            // Stop if we've scanned 50k txs
            if (totalTxs > 50000) {
                console.log('Reached 50k transaction limit.');
                break;
            }

            // Delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            console.error('Error:', e);
            break;
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
    console.log(`Total transactions scanned: ${totalTxs}`);
    console.log(`Registration transactions: ${registrationTxs}`);
    console.log(`Total nodes: ${devnetNodes.size}`);
    console.log(`Mappings discovered: ${nodeToWallet.size}`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

scanProgramTransactions().catch(console.error);
