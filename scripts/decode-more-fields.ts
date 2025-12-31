import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, { filters: [{ dataSize: 1040 }] });

    console.log('=== DECODING BYTES 36-40 as u32 ===\n');

    const data = [];
    for (const acc of accounts) {
        const u32_36 = acc.account.data.readUInt32LE(36);
        const price = acc.account.data.readUInt16LE(34);
        data.push({ pubkey: acc.pubkey.toBase58(), u32_36, price });
    }

    data.sort((a, b) => a.u32_36 - b.u32_36);

    console.log('First 10 (earliest):');
    data.slice(0, 10).forEach(d => {
        console.log(`  ${d.pubkey.slice(0, 12)}: u32=${d.u32_36}, price=${d.price}`);
    });

    console.log('\n\Last 10 (latest):');
    data.slice(-10).forEach(d => {
        console.log(`  ${d.pubkey.slice(0, 12)}: u32=${d.u32_36}, price=${d.price}`);
    });

    console.log('\n=== CHECKING IF BYTES 76-80 CONTAIN USEFUL DATA ===');
    // Check if there's a version field after the manager wallet

    const versionCandidates = [];
    for (const acc of accounts) {
        const bytes76_80 = acc.account.data.slice(76, 80).toString('hex');
        const byte76 = acc.account.data[76];
        const byte77 = acc.account.data[77];
        const price = acc.account.data.readUInt16LE(34);

        versionCandidates.push({ byte76, byte77, price, hex: bytes76_80 });
    }

    // Group by byte76
    const by76 = new Map<number, number>();
    versionCandidates.forEach(v => {
        by76.set(v.byte76, (by76.get(v.byte76) || 0) + 1);
    });

    console.log('\nByte 76 distribution:', Array.from(by76.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10));
}

run().catch(console.error);
