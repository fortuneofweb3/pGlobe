
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const TARGET_WALLET = new PublicKey('5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W');
const XAND_MINT = 'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx';

async function traceRewards() {
    console.log(`Tracing XAND rewards for ${TARGET_WALLET.toBase58()} on Mainnet...`);
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // Get last 20 signatures
    const sigs = await connection.getSignaturesForAddress(TARGET_WALLET, { limit: 20 });
    console.log(`Found ${sigs.length} transactions.`);

    // Parse each transaction
    for (const sig of sigs) {
        const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) continue;

        const date = new Date((tx.blockTime || 0) * 1000).toISOString();

        // Check for XAND token transfers TO this wallet
        const instructions = tx.transaction.message.instructions;
        for (const ix of instructions) {
            // Check if it's a token transfer
            if ('parsed' in ix && (ix.parsed.type === 'transfer' || ix.parsed.type === 'transferChecked')) {
                const info = ix.parsed.info;
                if (info.mint === XAND_MINT || info.destination) {
                    console.log(`\n[${date}] Token Transfer:`);
                    console.log(`   Signature: ${sig.signature}`);
                    console.log(`   Type: ${ix.parsed.type}`);
                    console.log(`   Info: ${JSON.stringify(info, null, 2)}`);
                }
            }

            // Check for any program invocation
            if ('programId' in ix) {
                const programId = ix.programId.toString();
                // @ts-ignore
                const programName = ix.program || programId;
                if (programName !== 'spl-token' && programName !== 'system') {
                    console.log(`\n[${date}] Program Invocation:`);
                    console.log(`   Signature: ${sig.signature}`);
                    console.log(`   Program: ${programName} (${programId})`);
                }
            }
        }

        // Also check inner instructions (CPI calls)
        const innerIxs = tx.meta?.innerInstructions || [];
        for (const inner of innerIxs) {
            for (const ix of inner.instructions) {
                if ('parsed' in ix && ix.parsed?.type === 'transfer' && ix.parsed?.info?.mint === XAND_MINT) {
                    console.log(`\n[${date}] Inner Token Transfer (CPI):`);
                    console.log(`   Source Program Index: ${inner.index}`);
                    console.log(`   Info: ${JSON.stringify(ix.parsed.info, null, 2)}`);
                }
            }
        }
    }
}

traceRewards().catch(console.error);
