import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function inspectPurchaseTxs() {
    const conn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('Fetching recent signatures for Purchase Program...');
    // Get last 20 signatures
    const signatures = await conn.getSignaturesForAddress(MAINNET_PROGRAM, { limit: 20 });

    console.log(`Found ${signatures.length} recent transactions.`);

    for (const sigInfo of signatures) {
        console.log(`\n--- Inspecting TX: ${sigInfo.signature} ---`);
        if (sigInfo.err) {
            console.log(' (Failed TX, skipping)');
            continue;
        }

        const tx = await conn.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            console.log('TX not found (cleaned up?)');
            continue;
        }

        // Look at logs to guess instruction input
        const logs = tx.meta?.logMessages || [];
        console.log('Logs:', logs.slice(0, 3)); // First few logs usually show instruction call

        // Look for Node Pubkey in Account Keys
        // If the user bought a license for a specific node, the Node Pubkey SHOULD be in the account list
        // even if not a signer.
        // Let's print all accounts involved.
        const accountKeys = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
        console.log('Accounts involved:', accountKeys.length);
        // console.log(accountKeys);

        // Can we identify a Node Pubkey? 
        // Usually pNodes are new random keys, but tough to distinguish from other random keys without context.
        // BUT if the instruction parser can show us... 
        // Let's check the instruction data size.

        // Note: Parsing raw instruction data is hard without IDL, but we can look for 32-byte patterns if we know what we are looking for.
    }

    process.exit(0);
}

inspectPurchaseTxs();
