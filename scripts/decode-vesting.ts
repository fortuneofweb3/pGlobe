
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const VESTING_ACCOUNT = new PublicKey('BR2gRvkVUrJ3gNGgChJNdXcM7cdCQYeYUGNSEkv4Mjxy');

async function decodeVesting() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log(`Fetching ${VESTING_ACCOUNT.toBase58()}...`);

    const info = await connection.getAccountInfo(VESTING_ACCOUNT);
    if (!info) return console.log('Account not found');

    const data = info.data;
    console.log(`Data Len: ${data.length}`);

    // Decode Pubkeys
    const key1 = new PublicKey(data.slice(8, 40));
    const key2 = new PublicKey(data.slice(40, 72));
    const key3 = new PublicKey(data.slice(72, 104)); // We know this is Manager

    console.log(`Offset 8-40:  ${key1.toBase58()}`);
    console.log(`Offset 40-72: ${key2.toBase58()}`);
    console.log(`Offset 72-104: ${key3.toBase58()} (Manager)`);

    // Check balances of key1 and key2
    console.log('\nChecking Token Balances...');
    try {
        const bal1 = await connection.getTokenAccountBalance(key1);
        console.log(`Key 1 Balance: ${bal1.value.uiAmount} (${key1.toBase58()})`);
    } catch (e) { console.log(`Key 1 is likely not a Token Account (${e.message})`); }

    try {
        const bal2 = await connection.getTokenAccountBalance(key2);
        console.log(`Key 2 Balance: ${bal2.value.uiAmount} (${key2.toBase58()})`);
    } catch (e) { console.log(`Key 2 is likely not a Token Account (${e.message})`); }

    // Decode parameters at 104+
    console.log('\nDecoding Parameters (104+):');
    const part = data.slice(104);
    console.log(`Hex: ${part.toString('hex')}`);

    // Read u64s
    const u64_1 = part.readBigUInt64LE(0); // 104
    const u8_1 = part.readUInt8(8);        // 112
    const u64_2 = part.readBigUInt64LE(9); // 113

    console.log(`104 (u64): ${u64_1.toString()} (Hex: ${u64_1.toString(16)})`);
    console.log(`112 (u8):  ${u8_1}`);
    console.log(`113 (u64): ${u64_2.toString()} (Hex: ${u64_2.toString(16)})`);

    // "365 periods" -> 365?
    if (Number(u64_1) === 365) console.log('MATCH: 365 found at 104!');
}

decodeVesting();
