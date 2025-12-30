
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx'); // Correct Xand Mint

async function checkXandBalance() {
    const connection = new Connection(RPC_URL, 'confirmed');
    const targetStr = 'BR2gRvkVUrJ3gNGgChJNdXcM7cdCQYeYUGNSEkv4Mjxy'; // Vesting Account
    console.log(`Checking XAND balance for ${targetStr}...`);

    try {
        const pubkey = new PublicKey(targetStr);

        // Find ATA with retries
        let retries = 5;
        let delay = 1000;
        let response = null;

        while (retries > 0) {
            try {
                response = await connection.getTokenAccountsByOwner(pubkey, { mint: XAND_MINT });
                break;
            } catch (err: any) {
                if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
                    console.log(`Rate limited. Waiting ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    retries--;
                } else {
                    throw err;
                }
            }
        }

        if (!response) {
            console.log('Failed to fetch token accounts after retries.');
            return;
        }

        if (response.value.length === 0) {
            console.log('No XAND Token Accounts found for this owner.');
        } else {
            console.log(`Found ${response.value.length} XAND Token Accounts.`);
            for (const { pubkey: ata, account } of response.value) {
                // simple manual decode of amount (u64 at offset 64)
                const { AccountLayout } = await import('@solana/spl-token');
                const data = AccountLayout.decode(account.data);
                console.log(`  ATA: ${ata.toBase58()}`);
                console.log(`  Balance: ${Number(data.amount) / 1e9} XAND`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

checkXandBalance();
