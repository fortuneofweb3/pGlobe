import { Connection, PublicKey } from '@solana/web3.js';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const all = await conn.getProgramAccounts(DEVNET_PROGRAM, { filters: [{ dataSize: 1040 }] });
    const discs: Record<string, number> = {};
    const samples: Record<string, string> = {};
    
    all.forEach(a => {
        const d = a.account.data.slice(0, 8).toString('hex');
        discs[d] = (discs[d] || 0) + 1;
        if (!samples[d]) samples[d] = a.pubkey.toBase58();
    });
    
    console.log('Discriminator Distribution (1040-byte accounts):');
    console.log(JSON.stringify(discs, null, 2));
    
    console.log('\nAnalyzing Samples:');
    for (const d of Object.keys(samples)) {
        const pk = new PublicKey(samples[d]);
        const acc = all.find(a => a.pubkey.equals(pk))!;
        const data = acc.account.data;
        
        // Let's check offset 8 (Legacy version?)
        const v8 = data[8];
        const v9 = data[9];
        
        // Era ID at 32
        const era32 = data.readUInt16LE(32);
        
        console.log(`Disc ${d}:`);
        console.log(`  Example: ${samples[d]}`);
        console.log(`  Byte 8: ${v8} (Hex: ${v8.toString(16)})`);
        console.log(`  Byte 9: ${v9} (Hex: ${v9.toString(16)})`);
        console.log(`  Era ID (32): ${era32}`);
    }
}
run().catch(console.error);
