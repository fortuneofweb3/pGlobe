
import { Connection } from '@solana/web3.js';
import { enrichPNodeWithOnChainData } from '../lib/server/solana-pnodes';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function testEra() {
    console.log('Testing Era Logic...');
    const connection = new Connection(RPC_URL, 'confirmed');
    // GCoCP (Managed by Bx1aH)
    const pubkey = 'GCoCP7CLvVivuWUH1sSA9vMi9jjaJcXpMwVozMVA6yBg';

    try {
        const data = await enrichPNodeWithOnChainData(pubkey, connection);
        console.log('Result:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

testEra();
