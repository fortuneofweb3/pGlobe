/**
 * Check if Mainnet has any PDAs derived from node pubkeys
 * Also check unregistered nodes specifically
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// An unregistered node example 
const UNREGISTERED_NODE = 'BTy8gWMBozRFhoNuTfiSL8yqDe6VhUJ5F52A79D74snY';

async function checkNodePDAs() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Checking PDAs for Unregistered Node ===\n');
    console.log(`Node: ${UNREGISTERED_NODE}\n`);

    const nodePubkey = new PublicKey(UNREGISTERED_NODE);

    // Check Devnet PDAs
    console.log('--- Devnet PDAs ---\n');

    const devnetSeeds = ['registry', 'manager', 'node', 'pnode', 'owner'];
    for (const seed of devnetSeeds) {
        try {
            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from(seed), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );
            const info = await devConn.getAccountInfo(pda);
            console.log(`  "${seed}" + node: ${pda.toBase58()} - ${info ? `EXISTS (${info.data.length} bytes)` : 'NOT FOUND'}`);
        } catch (e) {
            console.log(`  "${seed}" + node: ERROR`);
        }
    }

    // Check Mainnet PDAs
    console.log('\n--- Mainnet PDAs ---\n');

    for (const seed of devnetSeeds) {
        try {
            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from(seed), nodePubkey.toBuffer()],
                MAINNET_PROGRAM
            );
            const info = await mainConn.getAccountInfo(pda);
            console.log(`  "${seed}" + node: ${pda.toBase58()} - ${info ? `EXISTS (${info.data.length} bytes)` : 'NOT FOUND'}`);
        } catch (e) {
            console.log(`  "${seed}" + node: ERROR`);
        }
    }

    // Check if this unregistered node has any transaction history on Mainnet
    console.log('\n--- Node Transaction History (Mainnet) ---\n');

    try {
        const sigs = await mainConn.getSignaturesForAddress(nodePubkey, { limit: 10 });
        if (sigs.length === 0) {
            console.log('  No Mainnet transactions for this node.');
        } else {
            console.log(`  Found ${sigs.length} transactions!`);
            for (const sig of sigs) {
                console.log(`    ${sig.signature}`);
            }
        }
    } catch (e) {
        console.log(`  Error: ${e}`);
    }

    // Check Devnet transaction history
    console.log('\n--- Node Transaction History (Devnet) ---\n');

    try {
        const sigs = await devConn.getSignaturesForAddress(nodePubkey, { limit: 10 });
        if (sigs.length === 0) {
            console.log('  No Devnet transactions for this node.');
        } else {
            console.log(`  Found ${sigs.length} transactions:`);
            for (const sig of sigs) {
                console.log(`    ${sig.signature}`);

                // Get the transaction to see who signed it
                const tx = await devConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                if (tx) {
                    const signers = tx.transaction.message.accountKeys.filter(a => a.signer);
                    for (const s of signers) {
                        if (s.pubkey.toBase58() !== UNREGISTERED_NODE) {
                            console.log(`      Signer: ${s.pubkey.toBase58()}`);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log(`  Error: ${e}`);
    }

    // Get all unregistered nodes and check for patterns
    console.log('\n\n=== Checking Multiple Unregistered Nodes ===\n');

    // Get all devnet nodes
    const indexInfo = await devConn.getAccountInfo(DEVNET_INDEX);
    const allNodes: string[] = [];
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() !== '11111111111111111111111111111111') {
                allNodes.push(pk.toBase58());
            }
        }
    }

    // Find unregistered nodes (no registry PDA)
    console.log(`Checking which nodes are unregistered...\n`);
    const unregisteredNodes: string[] = [];

    for (let i = 0; i < Math.min(allNodes.length, 20); i++) {
        const nodePk = new PublicKey(allNodes[i]);
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePk.toBuffer()],
            DEVNET_PROGRAM
        );
        const info = await devConn.getAccountInfo(registryPda);
        if (!info) {
            unregisteredNodes.push(allNodes[i]);
            console.log(`  Unregistered: ${allNodes[i]}`);
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\nFound ${unregisteredNodes.length} unregistered nodes in first 20\n`);

    // For a few unregistered nodes, check their transaction history
    console.log('=== Transaction History of Unregistered Nodes ===\n');

    for (const nodeId of unregisteredNodes.slice(0, 3)) {
        console.log(`\nNode: ${nodeId}`);

        const sigs = await devConn.getSignaturesForAddress(new PublicKey(nodeId), { limit: 5 });
        console.log(`  Transactions: ${sigs.length}`);

        for (const sig of sigs.slice(0, 2)) {
            const tx = await devConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (tx) {
                const signers = tx.transaction.message.accountKeys
                    .filter(a => a.signer)
                    .filter(a => a.pubkey.toBase58() !== nodeId);

                if (signers.length > 0) {
                    console.log(`  Other signers: ${signers.map(s => s.pubkey.toBase58()).join(', ')}`);
                }

                // Check logs
                const logs = tx.meta?.logMessages || [];
                const relevantLogs = logs.filter(l =>
                    l.includes('Instruction') ||
                    l.includes('register') ||
                    l.includes('Register')
                );
                if (relevantLogs.length > 0) {
                    console.log(`  Logs: ${relevantLogs.join('; ')}`);
                }
            }
        }
    }
}

checkNodePDAs().catch(console.error);
