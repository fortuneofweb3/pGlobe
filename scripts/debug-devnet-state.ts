
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = "https://api.devnet.xandeum.com:8899";
const PROGRAM_ID = new PublicKey("6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL");
const INDEX_ACCOUNT = new PublicKey("GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs");

async function main() {
    const conn = new Connection(RPC, 'confirmed');
    console.log(`Checking Devnet State on ${RPC}...`);

    // 1. Check Global
    const globalPDA = PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM_ID)[0];
    console.log(`Global PDA: ${globalPDA.toBase58()}`);
    const globalInfo = await conn.getAccountInfo(globalPDA);
    if (!globalInfo) {
        console.log(`  ❌ Global Account NOT FOUND!`);
    } else {
        console.log(`  ✅ Found Global. Size: ${globalInfo.data.length} bytes.`);
        console.log(`  Owner: ${globalInfo.owner.toBase58()}`);
        console.log(`  Data (first 8 bytes): ${globalInfo.data.slice(0, 8).toString('hex')}`);
    }

    // 2. Check Index
    console.log(`Index Account: ${INDEX_ACCOUNT.toBase58()}`);
    const indexInfo = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!indexInfo) {
        console.log(`  ❌ Index Account NOT FOUND!`);
    } else {
        console.log(`  ✅ Found Index. Size: ${indexInfo.data.length} bytes.`);
        console.log(`  Owner: ${indexInfo.owner.toBase58()}`);
        console.log(`  Data (first 8 bytes): ${indexInfo.data.slice(0, 8).toString('hex')}`);
    }
}

main();
