/**
 * Investigate how nodes get INTO the index account
 * There must be some write operation - let's find it!
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function investigateIndexAccount() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Investigating the Index Account ===\n');
    console.log(`Index Account: ${DEVNET_INDEX.toBase58()}\n`);

    // Get info about the index account itself
    const indexInfo = await connection.getAccountInfo(DEVNET_INDEX);
    if (!indexInfo) {
        console.log('Index account not found!');
        return;
    }

    console.log(`Owner: ${indexInfo.owner.toBase58()}`);
    console.log(`Data size: ${indexInfo.data.length} bytes`);
    console.log(`Lamports: ${indexInfo.lamports}`);
    console.log(`Executable: ${indexInfo.executable}`);

    // Check transaction history of the INDEX account
    console.log('\n=== Transaction History of Index Account ===\n');

    const sigs = await connection.getSignaturesForAddress(DEVNET_INDEX, { limit: 20 });
    console.log(`Found ${sigs.length} transactions\n`);

    for (const sig of sigs.slice(0, 10)) {
        console.log(`TX: ${sig.signature}`);
        console.log(`  Time: ${sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'N/A'}`);

        const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (tx) {
            // Get all signers
            const signers = tx.transaction.message.accountKeys
                .filter(a => a.signer)
                .map(a => a.pubkey.toBase58());
            console.log(`  Signers: ${signers.join(', ')}`);

            // Get instruction logs
            const logs = tx.meta?.logMessages || [];
            const instructionLogs = logs.filter(l =>
                l.includes('Instruction') ||
                l.includes('Program log:')
            );
            for (const log of instructionLogs.slice(0, 3)) {
                console.log(`  ${log}`);
            }

            // Check if any account looks like a node pubkey
            const accountKeys = tx.transaction.message.accountKeys.map(a => a.pubkey.toBase58());
            console.log(`  Account keys: ${accountKeys.length}`);
        }
        console.log('');
    }

    // Check if index account is written to by the program
    console.log('\n=== Checking Program Transactions ===\n');

    const programSigs = await connection.getSignaturesForAddress(DEVNET_PROGRAM, { limit: 10 });
    console.log(`Recent program transactions: ${programSigs.length}\n`);

    for (const sig of programSigs.slice(0, 5)) {
        const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (tx) {
            const logs = tx.meta?.logMessages || [];
            const instruction = logs.find(l => l.includes('Instruction :'));

            // Check if this tx touches the index
            const touchesIndex = tx.transaction.message.accountKeys
                .some(a => a.pubkey.toBase58() === DEVNET_INDEX.toBase58());

            console.log(`TX: ${sig.signature.slice(0, 40)}...`);
            console.log(`  ${instruction || 'No instruction found'}`);
            console.log(`  Touches index: ${touchesIndex}`);

            if (touchesIndex) {
                const signers = tx.transaction.message.accountKeys
                    .filter(a => a.signer)
                    .map(a => a.pubkey.toBase58());
                console.log(`  ** Signers: ${signers.join(', ')}`);
            }
            console.log('');
        }
    }

    // The key insight: is the index updated by gossip or by transactions?
    console.log('\n=== Theory ===\n');
    console.log('If the index has no recent transactions but nodes keep appearing,');
    console.log('it means the index might be updated by the validator software itself');
    console.log('(off-ledger / gossip-based) rather than through on-chain txs.');
}

investigateIndexAccount().catch(console.error);
