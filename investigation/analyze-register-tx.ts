/**
 * Analyze RegisterPnode transactions in detail
 * Extract the node pubkey and signer (registrar) from each
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function analyzeRegisterTransactions() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Analyzing RegisterPnode Transactions ===\n');

    // Get all transactions that touched the index
    const sigs = await connection.getSignaturesForAddress(DEVNET_INDEX, { limit: 50 });
    console.log(`Found ${sigs.length} transactions\n`);

    const nodeToRegistrar: Map<string, { registrar: string, timestamp: string, txSig: string }> = new Map();

    for (const sig of sigs) {
        const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) continue;

        // Get the signer (registrar)
        const signers = tx.transaction.message.accountKeys
            .filter(a => a.signer)
            .map(a => a.pubkey.toBase58());

        // Get all account keys
        const accountKeys = tx.transaction.message.accountKeys.map(a => ({
            pubkey: a.pubkey.toBase58(),
            signer: a.signer,
            writable: a.writable
        }));

        console.log(`TX: ${sig.signature}`);
        console.log(`  Time: ${sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'N/A'}`);
        console.log(`  Signer: ${signers[0]}`);
        console.log(`  All accounts:`);

        for (let i = 0; i < accountKeys.length; i++) {
            const acc = accountKeys[i];
            let role = '';
            if (acc.signer) role += '[SIGNER] ';
            if (acc.writable) role += '[WRITABLE] ';

            // Identify known accounts
            if (acc.pubkey === DEVNET_INDEX.toBase58()) role += '<INDEX>';
            if (acc.pubkey === DEVNET_PROGRAM.toBase58()) role += '<PROGRAM>';
            if (acc.pubkey === '11111111111111111111111111111111') role += '<SYSTEM>';
            if (acc.pubkey === 'SysvarRent111111111111111111111111111111111') role += '<RENT>';

            console.log(`    [${i}] ${acc.pubkey} ${role}`);
        }

        // The node pubkey should be one of the non-system, non-program accounts
        // that is writable but not the index and not the signer
        const potentialNode = accountKeys.find(a =>
            a.writable &&
            !a.signer &&
            a.pubkey !== DEVNET_INDEX.toBase58() &&
            a.pubkey !== DEVNET_PROGRAM.toBase58() &&
            a.pubkey !== '11111111111111111111111111111111' &&
            !a.pubkey.includes('Sysvar')
        );

        if (potentialNode) {
            console.log(`  ** Potential Node Pubkey: ${potentialNode.pubkey}`);

            // Verify it's a valid node by checking if it has a registry PDA
            const nodePk = new PublicKey(potentialNode.pubkey);
            const [registryPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePk.toBuffer()],
                DEVNET_PROGRAM
            );
            const regInfo = await connection.getAccountInfo(registryPda);
            console.log(`  ** Has Registry PDA: ${regInfo ? 'YES' : 'NO'}`);

            nodeToRegistrar.set(potentialNode.pubkey, {
                registrar: signers[0],
                timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'N/A',
                txSig: sig.signature
            });
        }

        console.log('');
    }

    console.log('\n=== Summary: Node to Registrar Mapping ===\n');
    console.log(`Found ${nodeToRegistrar.size} mappings from RegisterPnode transactions\n`);

    for (const [node, info] of nodeToRegistrar.entries()) {
        console.log(`Node: ${node}`);
        console.log(`  Registrar: ${info.registrar}`);
        console.log(`  Timestamp: ${info.timestamp}`);
        console.log('');
    }

    // Now check if any of these are unregistered
    console.log('\n=== Checking if any extracted nodes are now unregistered ===\n');

    for (const [nodeId, info] of nodeToRegistrar.entries()) {
        const nodePk = new PublicKey(nodeId);
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePk.toBuffer()],
            DEVNET_PROGRAM
        );
        const regInfo = await connection.getAccountInfo(registryPda);

        if (!regInfo) {
            console.log(`** UNREGISTERED NODE FOUND IN TX HISTORY! **`);
            console.log(`  Node: ${nodeId}`);
            console.log(`  Registrar (from TX): ${info.registrar}`);
            console.log(`  TX: ${info.txSig}`);
        }
    }
}

analyzeRegisterTransactions().catch(console.error);
