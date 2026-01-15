
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Account with count 2
const TARGET_ACCOUNT = 'sHokok1QWtQePa9vHeA5dXzB2PrFaPfxzth6s2hvXwa';

async function main() {
    console.log(`Connecting to ${HELIUS_RPC}...`);
    const connection = new Connection(HELIUS_RPC, 'confirmed');
    const pubkey = new PublicKey(TARGET_ACCOUNT);

    console.log(`Fetching signatures for ${TARGET_ACCOUNT}...`);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 10 });

    console.log(`Found ${signatures.length} transactions.`);

    for (const sigInfo of signatures) {
        console.log(`\n--- Tx: ${sigInfo.signature} ---`);
        console.log(`Time: ${sigInfo.blockTime ? new Date(sigInfo.blockTime * 1000).toISOString() : '?'}`);

        const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx) {
            console.log('  Tx not found/null');
            continue;
        }

        const logs = tx.meta?.logMessages || [];
        if (logs.length > 0) {
            console.log('  Logs:');
            logs.forEach(log => console.log(`    ${log}`));
        } else {
            console.log('  No logs.');
        }

        // Check for recognized patterns?
        // Program Data?
    }
}

main().catch(console.error);
