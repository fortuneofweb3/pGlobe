import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const vestingAccount = new PublicKey('BR2gRvkVUrJ3gNGgChJNdXcM7cdCQYeYUGNSEkv4Mjxy');
const managerWallet = '3gnisfmyxw8Bch1SHZZ16UDtRG853vv52sPb726jgdbu';
const amount = new BN('30000000000000'); // 30,000 XAND

async function findOffsets() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log(`Fetching account ${vestingAccount.toBase58()}...`);

    const info = await connection.getAccountInfo(vestingAccount);
    if (!info) {
        console.log('Account not found');
        return;
    }

    const buffer = info.data;
    const pubkey = new PublicKey(managerWallet);
    const pubkeyBuffer = pubkey.toBuffer();

    console.log(`Analyzing Buffer of length ${buffer.length}...`);
    console.log(`Looking for Pubkey: ${managerWallet}`);

    // Search for Pubkey
    let foundPubkey = false;
    for (let i = 0; i <= buffer.length - 32; i++) {
        if (buffer.slice(i, i + 32).equals(pubkeyBuffer)) {
            console.log(`✅ FOUND Pubkey at Offset: ${i}`);
            foundPubkey = true;
        }
    }
    if (!foundPubkey) console.log('❌ Pubkey NOT found in first 64 bytes (might be later in full data)');

    console.log(`FULL HEX DUMP:`);
    console.log(buffer.toString('hex'));

    // Search for Amount (u64 LE)
    const amountBuffer = amount.toArrayLike(Buffer, 'le', 8);
    console.log(`Looking for Amount: ${amount.toString()} (Hex: ${amountBuffer.toString('hex')})`);

    let foundAmount = false;
    for (let i = 0; i <= buffer.length - 8; i++) {
        if (buffer.slice(i, i + 8).equals(amountBuffer)) {
            console.log(`✅ FOUND Amount at Offset: ${i}`);
            foundAmount = true;
        }
    }
    if (!foundAmount) console.log('❌ Amount NOT found in partial data');
}

findOffsets();
