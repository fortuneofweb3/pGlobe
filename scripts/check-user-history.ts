
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const TARGET_WALLETS = [
    'D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2',
    'F4XJsyo3gfDfrLMNoC3q3jpTWzF2vx8ntVJX9F2PLj5X'
];

async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0 && (e.message?.includes('429') || e.toString().includes('429'))) {
            // console.log(`  Rate limited. Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            return withRetry(fn, retries - 1);
        }
        throw e;
    }
}

async function main() {
    const conn = new Connection(RPC_URL, 'confirmed');

    for (const walletStr of TARGET_WALLETS) {
        console.log(`\nAnalyzing history for: ${walletStr}`);
        const wallet = new PublicKey(walletStr);

        const signatures = await withRetry(() => conn.getSignaturesForAddress(wallet, { limit: 20 }));

        for (const sigInfo of signatures) {
            const tx = await withRetry(() => conn.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 }));
            if (!tx) continue;

            const message = tx.transaction.message as any;
            const compiledInstructions = message.compiledInstructions || message.instructions;
            const accountKeys = message.staticAccountKeys ? message.staticAccountKeys.map(k => k.toBase58()) : [];

            for (const ix of compiledInstructions) {
                const progId = accountKeys[ix.programIdIndex];
                if (progId === PROGRAM_ID.toBase58()) {
                    const data = Buffer.from(ix.data);
                    const type = data.length > 0 ? data[0] : 'unknown';
                    console.log(`  Tx: ${sigInfo.signature.slice(0, 10)}... | Slot: ${sigInfo.slot} | Instr: ${type} | err: ${sigInfo.err ? 'YES' : 'No'}`);
                }
            }
        }
    }
}

main();
