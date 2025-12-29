
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const TX_SIG = 'ZQcMZHXT137nC6nH6SALopFJQ1VHrUqksFPfcBBy2YdaDwanKr5hNSjDSDdxBPnzJKR5dPszyeGrrjA26ahKgbj';
const MAINNET_PROGRAM = 'CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL';

async function analyzeTx() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    console.log(`Analyzing Transaction: ${TX_SIG}\n`);

    const tx = await connection.getParsedTransaction(TX_SIG, { maxSupportedTransactionVersion: 0 });
    if (!tx) {
        console.log('Transaction not found!');
        return;
    }

    console.log(`Block Time: ${new Date((tx.blockTime || 0) * 1000).toISOString()}`);
    console.log(`Fee: ${tx.meta?.fee} lamports`);
    console.log(`Success: ${!tx.meta?.err}`);

    // Account Keys
    console.log('\n--- Account Keys ---');
    const accountKeys = tx.transaction.message.accountKeys;
    accountKeys.forEach((key, i) => {
        console.log(`[${i}] ${key.pubkey.toBase58()} ${key.signer ? '(signer)' : ''} ${key.writable ? '(writable)' : ''}`);
    });

    // Instructions
    console.log('\n--- Instructions ---');
    tx.transaction.message.instructions.forEach((ix, i) => {
        if ('programId' in ix) {
            console.log(`\nInstruction ${i}: Program ${ix.programId.toString()}`);
            if (ix.programId.toString() === MAINNET_PROGRAM) {
                console.log('   ^ This is our target program!');
                // @ts-ignore
                if (ix.accounts) {
                    console.log('   Accounts:');
                    // @ts-ignore
                    ix.accounts.forEach((acc, j) => {
                        console.log(`      [${j}] ${acc.toString()}`);
                    });
                }
                // @ts-ignore
                if (ix.data) {
                    // @ts-ignore
                    console.log(`   Data (Base58): ${ix.data}`);
                }
            }
            if ('parsed' in ix) {
                console.log(`   Parsed Type: ${ix.parsed?.type}`);
            }
        }
    });

    // Log Messages (for instruction decoding hints)
    console.log('\n--- Log Messages (first 20) ---');
    const logs = tx.meta?.logMessages || [];
    logs.slice(0, 20).forEach(log => console.log(log));
}

analyzeTx().catch(console.error);
