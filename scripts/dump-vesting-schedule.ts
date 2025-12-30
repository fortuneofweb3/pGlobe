
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const GRANT_ACCOUNT = new PublicKey('ErNipzhgxv6Ci6K1PauVJZ2c1TrznGm1iGe2UKYq6xFd');

async function dumpSchedule() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log(`Fetching Grant Account ${GRANT_ACCOUNT.toBase58()}...`);

    const info = await connection.getAccountInfo(GRANT_ACCOUNT);
    if (!info) return console.log('Account not found');

    const data = info.data;
    console.log(`Data Len: ${data.length}`);

    // Header Timestamps?
    const t1 = Number(data.readBigUInt64LE(72));
    const t2 = Number(data.readBigUInt64LE(80));
    console.log(`Header T1: ${new Date(t1 * 1000).toISOString()} (${t1})`);
    console.log(`Header T2: ${new Date(t2 * 1000).toISOString()} (${t2})`);

    const START = 104;
    const STRIDE = 80;

    console.log(`\n--- Inspecting First Grant Struct (Offset ${START}) ---`);
    const chunk = data.slice(START, START + STRIDE);
    console.log('Hex Dump:');
    console.log(chunk.toString('hex'));

    console.log('\nInterpreting Fields:');
    console.log(`Offset 0 (Amount): ${Number(chunk.readBigUInt64LE(0)) / 1e9} XAND`);
    console.log(`Offset 8 (u64):    ${chunk.readBigUInt64LE(8).toString(16)} (Hex)`);
    console.log(`Offset 16 (u64):   ${Number(chunk.readBigUInt64LE(16))}`);
    console.log(`Offset 24 (u64):   ${Number(chunk.readBigUInt64LE(24))}`);

    // Check Tranche 2
    const START2 = 184;
    console.log(`\n--- Inspecting Second Grant Struct (Offset ${START2}) ---`);
    const chunk2 = data.slice(START2, START2 + STRIDE);

    const tStart2 = Number(chunk2.readBigUInt64LE(56));
    const tEnd2 = Number(chunk2.readBigUInt64LE(64));

    console.log(`T2 Start: ${new Date(tStart2 * 1000).toISOString()} (${tStart2})`);
    console.log(`T2 End:   ${new Date(tEnd2 * 1000).toISOString()} (${tEnd2})`);

    if (tStart2 > 0 && tStart2 !== t1) {
        console.log('DIFFERENT SCHEDULE!');
    } else {
        console.log('SAME SCHEDULE!');
    }
}

dumpSchedule();
