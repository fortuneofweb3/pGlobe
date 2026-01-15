
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0 && (e.message?.includes('429') || e.toString().includes('429'))) {
            console.log(`  Rate limited. Retrying in 5s... (${retries} left)`);
            await new Promise(r => setTimeout(r, 5000));
            return withRetry(fn, retries - 1);
        }
        throw e;
    }
}

async function main() {
    const conn = new Connection(RPC_URL, 'confirmed');
    console.log('Fetching signatures...');
    const signatures = await conn.getSignaturesForAddress(PROGRAM_ID, { limit: 2 });

    // Process strictly sequentially with delay
    const account1Counts: Record<string, number> = {};

    for (const sigInfo of signatures) {
        await new Promise(r => setTimeout(r, 2000)); // Pace it
        const tx = await withRetry(() => conn.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 }));
        if (!tx) continue;

        const message = tx.transaction.message as any;
        const compiledInstructions = message.compiledInstructions || message.instructions;
        const accountKeys = message.staticAccountKeys ? message.staticAccountKeys.map(k => k.toBase58()) : [];

        for (const ix of compiledInstructions) {
            const programId = accountKeys[ix.programIdIndex];
            if (programId === PROGRAM_ID.toBase58()) {
                // Check if it's Instruction 7
                let isRegister = false;
                if (typeof ix.data === 'string') isRegister = ix.data === '7';
                else isRegister = ix.data[0] === 7;

                if (isRegister) {
                    const indices = ix.accounts || ix.accountKeyIndexes;
                    if (indices.length > 1) {
                        const acc1Index = indices[1];
                        // Resolve account key (handle lookup tables if needed, but simplistic check for now)
                        // Getting key from static keys for now, assuming it's there
                        let acc1 = '';
                        if (acc1Index < accountKeys.length) {
                            acc1 = accountKeys[acc1Index];
                        } else {
                            acc1 = `LookupTableIndex(${acc1Index})`;
                            // We aren't resolving lookups here, but noting index
                            // To fix, we should use tx.transaction.message.getAccountKeys() object if accessible or resolve manually
                            // But let's try simple static first
                        }

                        // Try to resolve properly using getAccountKeys() if available in newer web3.js
                        // Or just rely on what we can see

                        // Log Payer (Account 0) and Account 1
                        const payer = accountKeys[0];
                        console.log(`Payer: ${payer} -> Account1: ${acc1}`);

                        account1Counts[acc1] = (account1Counts[acc1] || 0) + 1;
                    }
                }
            }
        }
    }

    console.log('\nAccount [1] Usage in last 10 txs:');
    console.table(account1Counts);
}

main();
