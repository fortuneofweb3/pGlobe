
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function inspect() {
    const connection = new Connection(RPC_URL, 'confirmed');
    const targetStr = 'GmNr5BQQ8MJ4bNJt8wwpdBN9xbrwdK636srz3tZA9sEC';
    console.log(`Inspecting ${targetStr}...`);

    try {
        const pubkey = new PublicKey(targetStr);
        const info = await connection.getAccountInfo(pubkey);

        if (!info) {
            console.log('Account not found.');
            return;
        }

        console.log('Owner:', info.owner.toBase58());
        console.log('Executable:', info.executable);
        console.log('Lamports:', info.lamports);
        console.log('Data Length:', info.data.length);

        if (info.owner.toBase58() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
            const { AccountLayout } = await import('@solana/spl-token');
            try {
                const data = AccountLayout.decode(info.data);
                console.log('Token Account Details:');
                console.log('  Mint:', new PublicKey(data.mint).toBase58());
                console.log('  Owner:', new PublicKey(data.owner).toBase58());
                console.log('  Amount:', data.amount.toString());
            } catch (e) {
                console.log('Is Token Account but failed to decode:', e);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

inspect();
