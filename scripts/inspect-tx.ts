
import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function inspectTx() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');
    const signature = '5LKiZokJjWUrDWVity6GkwyQmQhvCYDU9EUwCJEadDK26pwNNCGHyZDJ86YsYeTqYsrr55eyDkKYBjnBSsfTLEyk';

    console.log(`Inspecting TX: ${signature}`);
    const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

    if (!tx) {
        console.log('TX not found');
        return;
    }

    console.log('Accounts:');
    for (const [i, k] of tx.transaction.message.accountKeys.entries()) {
        let role = '';
        if (k.signer) role += '[Signer]';
        if (k.writable) role += '[Writable]';

        // Fetch info
        const info = await connection.getAccountInfo(k.pubkey);
        const owner = info ? info.owner.toBase58() : 'Not Found';
        const len = info ? info.data.length : 0;
        const dataHex = info ? info.data.slice(0, 64).toString('hex') : ''; // First 64 bytes

        console.log(`  ${i}: ${k.pubkey.toBase58()} ${role}`);
        console.log(`     Owner: ${owner}, Len: ${len}`);
        if (len > 0) console.log(`     Data: ${dataHex}...`);
    }

    console.log('\nInstructions:');
    tx.transaction.message.instructions.forEach((ix: any, i) => {
        console.log(`  IX ${i}: Program ${ix.programId.toBase58()}`);
        if ('accounts' in ix) {
            console.log(`    Accounts: ${ix.accounts.map((a: any) => a.toBase58()).join(', ')}`);
        }
        if (ix.programId.toBase58() === '4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu') {
            console.log('    -> TARGET PROGRAM CALL');
            if ('data' in ix) console.log(`    Data: ${ix.data}`);
        }
    });

    // Also check logs
    console.log('\nLogs:');
    console.log(tx.meta?.logMessages?.join('\n'));
}

inspectTx();
