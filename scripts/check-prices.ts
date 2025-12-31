import { Connection, PublicKey } from '@solana/web3.js';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    const nodes: PublicKey[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32));
        if (pk.toBase58() !== '11111111111111111111111111111111') nodes.push(pk);
    }
    
    const stats: Record<string, number> = {};
    for (let i = 0; i < nodes.length; i += 50) {
        const batch = nodes.slice(i, i+50);
        const pdas = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('registry'), pk.toBuffer()], DEVNET_PROGRAM)[0]);
        const infos = await conn.getMultipleAccountsInfo(pdas);
        infos.forEach(info => {
            if (!info) return;
            const p = info.data.readBigUInt64LE(34).toString();
            stats[p] = (stats[p] || 0) + 1;
        });
    }
    console.log(JSON.stringify(stats, null, 2));
}
run();
