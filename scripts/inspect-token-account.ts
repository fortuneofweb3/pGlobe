
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ACCOUNTS = [
    new PublicKey('FBAKK1mzCBv26HkZ7buVoozVAduxq2uWDghGrVbvDuEK'),
    new PublicKey('GpXAak3zX8ZLBHWhhBWEBDSZuBsxzL4s6kk3gUPu9sEm')
];

async function inspectTokenAccount() {
    const connection = new Connection(RPC_URL, 'confirmed');

    for (const acc of ACCOUNTS) {
        console.log(`\nInspecting ${acc.toBase58()}...`);
        const info = await connection.getAccountInfo(acc);
        if (!info) {
            console.log('Account not found');
            continue;
        }

        console.log(`Owner: ${info.owner.toBase58()}`);
        console.log(`Data Len: ${info.data.length}`);

        // Try to parse as Token Account
        try {
            const parsed = await connection.getParsedAccountInfo(acc);
            if (parsed.value && 'parsed' in parsed.value.data) {
                console.log(`Parsed Data:`, JSON.stringify(parsed.value.data.parsed, null, 2));
            }
        } catch (e) { console.log('Not a parsed account'); }
    }
}

inspectTokenAccount();
