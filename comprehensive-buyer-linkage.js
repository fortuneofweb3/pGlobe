/**
 * Comprehensive Buyer-to-Node Linkage
 * 
 * STRATEGY: For each of the 119 Mainnet buyers with Devnet Manager PDAs,
 * scan their Devnet transaction history to find which specific nodes 
 * they registered.
 * 
 * The transactions should involve both:
 * 1. The buyer wallet (as signer)
 * 2. The node pubkey (as an account)
 * 3. The Devnet program
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

async function comprehensiveLinkage() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Comprehensive Buyer-to-Node Linkage ===\n');

    // Step 1: Get Mainnet buyers
    const mainAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const buyers = new Set();
    for (const acc of mainAccounts) {
        buyers.add(new PublicKey(acc.account.data.slice(0, 32)).toBase58());
    }
    console.log(`Mainnet buyers: ${buyers.size}`);

    // Step 2: Get Devnet nodes
    const indexInfo = await devConn.getAccountInfo(INDEX_ACCOUNT);
    const devnetNodes = new Set();
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(pk.toBase58());
        }
    }
    console.log(`Devnet nodes: ${devnetNodes.size}\n`);

    // Step 3: Scan each node's first transactions to find buyer
    console.log('Scanning each node for buyer wallet link...\n');

    const nodeToBuyer = new Map();
    let checked = 0;

    for (const nodeId of devnetNodes) {
        checked++;
        if (checked % 20 === 0) {
            console.log(`Progress: ${checked}/${devnetNodes.size}, found ${nodeToBuyer.size}...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);
            const sigs = await devConn.getSignaturesForAddress(nodePubkey, { limit: 20 });

            for (const sig of sigs) {
                const tx = await devConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                if (!tx) continue;

                // Check if this tx involves the Devnet program
                const involvesProgram = tx.transaction.message.accountKeys.some(
                    a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                );
                if (!involvesProgram) continue;

                // Find signers who are also Mainnet buyers
                const signers = tx.transaction.message.accountKeys.filter(a => a.signer);
                for (const signer of signers) {
                    const signerPubkey = signer.pubkey.toBase58();
                    if (signerPubkey === nodeId) continue;  // Skip the node itself

                    if (buyers.has(signerPubkey)) {
                        nodeToBuyer.set(nodeId, signerPubkey);
                        console.log(`  ✅ ${nodeId.slice(0, 8)}... -> ${signerPubkey.slice(0, 8)}...`);
                        break;
                    }
                }

                if (nodeToBuyer.has(nodeId)) break;
            }
        } catch (e) {
            // Skip errors
        }

        await new Promise(r => setTimeout(r, 50));
    }

    // Save results
    const mappings = Array.from(nodeToBuyer.entries()).map(([nodeId, managerWallet]) => ({
        nodeId,
        managerWallet,
        discoveredAt: new Date().toISOString()
    }));

    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Total nodes scanned: ${devnetNodes.size}`);
    console.log(`Nodes linked to buyers: ${nodeToBuyer.size}`);
    console.log(`Coverage: ${Math.round(nodeToBuyer.size / devnetNodes.size * 100)}%`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

comprehensiveLinkage().catch(console.error);
