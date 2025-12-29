/**
 * Comprehensive Manager Wallet Discovery
 * 
 * Strategy: For each Mainnet wallet that has a Devnet Manager PDA with registrations,
 * scan ALL their Devnet transactions (paginating through all history) to find which
 * nodes they registered.
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

async function comprehensiveScan() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get all Mainnet wallets
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = mainnetAccounts.map(a =>
        new PublicKey(a.account.data.slice(0, 32)).toBase58()
    );
    console.log(`Mainnet has ${mainnetWallets.length} wallets.\n`);

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

    // Find Mainnet wallets with Devnet registrations
    console.log('Finding wallets with Devnet Manager PDAs...');
    const walletsWithRegistrations: { wallet: string; count: number }[] = [];

    for (const wallet of mainnetWallets) {
        const [managerPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), new PublicKey(wallet).toBuffer()],
            DEVNET_PROGRAM
        );
        const info = await devnetConn.getAccountInfo(managerPDA);
        if (info && info.data.length === 34 && info.data[33] > 0) {
            walletsWithRegistrations.push({ wallet, count: info.data[33] });
        }
    }
    console.log(`Found ${walletsWithRegistrations.length} wallets with ${walletsWithRegistrations.reduce((s, w) => s + w.count, 0)} total registrations.\n`);

    // Now scan ALL transactions for each wallet (with pagination)
    console.log('Scanning full transaction history for each wallet...\n');
    const nodeToWallet = new Map<string, string>();
    let scannedWallets = 0;

    for (const { wallet, count } of walletsWithRegistrations) {
        scannedWallets++;
        console.log(`[${scannedWallets}/${walletsWithRegistrations.length}] Scanning ${wallet.slice(0, 8)}... (${count} registrations)...`);

        let foundForWallet = 0;
        const walletPubkey = new PublicKey(wallet);
        let lastSig: string | undefined;
        let totalTxs = 0;

        // Paginate through ALL transactions
        while (true) {
            try {
                const sigs = await devnetConn.getSignaturesForAddress(
                    walletPubkey,
                    { limit: 1000, before: lastSig }
                );

                if (sigs.length === 0) break;
                totalTxs += sigs.length;
                lastSig = sigs[sigs.length - 1].signature;

                for (const sig of sigs) {
                    try {
                        const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                        if (!tx) continue;

                        // Check if involves Devnet Program
                        const involvesProgram = tx.transaction.message.accountKeys.some(
                            a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                        );
                        if (!involvesProgram) continue;

                        // Find nodes in this transaction
                        for (const acc of tx.transaction.message.accountKeys) {
                            const pubkey = acc.pubkey.toBase58();
                            if (devnetNodes.has(pubkey) && !nodeToWallet.has(pubkey)) {
                                nodeToWallet.set(pubkey, wallet);
                                foundForWallet++;
                                console.log(`    ✅ ${pubkey.slice(0, 8)}...`);
                            }
                        }

                        // Stop if we found all expected registrations
                        if (foundForWallet >= count) break;
                    } catch { }
                }

                if (foundForWallet >= count) break;

                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 100));

                // If we've scanned 5000+ txs without finding all, give up
                if (totalTxs > 5000) {
                    console.log(`    ⚠️  Scanned ${totalTxs} txs, found ${foundForWallet}/${count}`);
                    break;
                }
            } catch (e) {
                break;
            }
        }

        console.log(`    Found ${foundForWallet}/${count} after ${totalTxs} txs`);

        // Delay between wallets
        await new Promise(r => setTimeout(r, 200));
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
    console.log(`Wallets with registrations: ${walletsWithRegistrations.length}`);
    console.log(`Total expected registrations: ${walletsWithRegistrations.reduce((s, w) => s + w.count, 0)}`);
    console.log(`Mappings discovered: ${nodeToWallet.size}`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

comprehensiveScan().catch(console.error);
