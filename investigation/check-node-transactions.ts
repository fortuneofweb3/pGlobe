/**
 * Investigate if we can trigger on-chain responses from nodes
 * 
 * Ideas:
 * 1. Check if nodes have any automated transaction behavior
 * 2. Look at existing transactions FROM node pubkeys to see who signs them
 * 3. Check if there are any claim/withdraw functions users must call
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

// A known unregistered node
const UNREGISTERED_NODE = 'BTy8gWMBozRFhoNuTfiSL8yqDe6VhUJ5F52A79D74snY';

async function investigateNodeTransactions() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Looking at Node Transaction Patterns ===\n');

    // Get all nodes
    const indexInfo = await connection.getAccountInfo(DEVNET_INDEX);
    const allNodes: string[] = [];
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() !== '11111111111111111111111111111111') {
                allNodes.push(pk.toBase58());
            }
        }
    }
    console.log(`Total nodes: ${allNodes.length}\n`);

    // For each node, check if it has any transaction history
    // If node signs transactions, we can see who else signed (the operator)
    console.log('=== Checking Transaction History of Nodes ===\n');

    let nodesWithTxs = 0;
    let nodesWithOutgoingTxs = 0;

    for (const nodeId of allNodes.slice(0, 30)) {
        const nodePk = new PublicKey(nodeId);

        // Check if it's registered
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePk.toBuffer()],
            DEVNET_PROGRAM
        );
        const registryInfo = await connection.getAccountInfo(registryPda);
        const isRegistered = !!registryInfo;

        // Get transaction history
        const sigs = await connection.getSignaturesForAddress(nodePk, { limit: 10 });

        if (sigs.length > 0) {
            nodesWithTxs++;
            console.log(`\nNode: ${nodeId} (${isRegistered ? 'registered' : 'UNREGISTERED'})`);
            console.log(`  Transactions: ${sigs.length}`);

            // Check if the node itself ever SIGNED a transaction
            for (const sig of sigs.slice(0, 3)) {
                try {
                    const tx = await connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx) {
                        const accountKeys = tx.transaction.message.accountKeys;
                        const nodeAcc = accountKeys.find(a => a.pubkey.toBase58() === nodeId);

                        if (nodeAcc?.signer) {
                            nodesWithOutgoingTxs++;
                            console.log(`  ** NODE IS A SIGNER **`);

                            // Find other signers - these are likely the operators!
                            const otherSigners = accountKeys
                                .filter(a => a.signer && a.pubkey.toBase58() !== nodeId);

                            for (const s of otherSigners) {
                                console.log(`    Other signer: ${s.pubkey.toBase58()}`);
                            }
                        }

                        // Check transaction type from logs
                        const logs = tx.meta?.logMessages || [];
                        const instruction = logs.find(l => l.includes('Instruction :'));
                        if (instruction) {
                            console.log(`  ${instruction}`);
                        }
                    }
                } catch (e) {
                    // Skip
                }
            }
        }

        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n\n=== Summary ===`);
    console.log(`Nodes checked: 30`);
    console.log(`Nodes with transaction history: ${nodesWithTxs}`);
    console.log(`Nodes that have signed transactions: ${nodesWithOutgoingTxs}`);

    // Specifically check unregistered nodes
    console.log(`\n\n=== Specifically Checking Unregistered Nodes ===\n`);

    let unregisteredCount = 0;
    let unregisteredWithTxs = 0;

    for (const nodeId of allNodes) {
        const nodePk = new PublicKey(nodeId);
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePk.toBuffer()],
            DEVNET_PROGRAM
        );
        const registryInfo = await connection.getAccountInfo(registryPda);

        if (!registryInfo) {
            unregisteredCount++;

            const sigs = await connection.getSignaturesForAddress(nodePk, { limit: 5 });
            if (sigs.length > 0) {
                unregisteredWithTxs++;
                console.log(`Unregistered node with TXs: ${nodeId}`);

                for (const sig of sigs.slice(0, 2)) {
                    const tx = await connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });
                    if (tx) {
                        const signers = tx.transaction.message.accountKeys
                            .filter(a => a.signer)
                            .map(a => a.pubkey.toBase58());
                        console.log(`  TX: ${sig.signature.slice(0, 20)}... | Signers: ${signers.join(', ')}`);
                    }
                }
            }

            if (unregisteredCount >= 10) break;
        }

        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\nUnregistered nodes checked: ${unregisteredCount}`);
    console.log(`Unregistered nodes with transactions: ${unregisteredWithTxs}`);
}

investigateNodeTransactions().catch(console.error);
