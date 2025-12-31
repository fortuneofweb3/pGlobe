import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const indexAcc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!indexAcc) return;
    
    const indexedNodes = new Set<string>();
    for (let i = 0; i < indexAcc.data.length; i += 32) {
        const pk = new PublicKey(indexAcc.data.slice(i, i+32)).toBase58();
        if (pk !== '11111111111111111111111111111111') indexedNodes.add(pk);
    }
    
    console.log(`Indexed nodes: ${indexedNodes.size}`);
    
    const allProgramAccounts = await conn.getProgramAccounts(DEVNET_PROGRAM);
    const sizeMap: Record<number, string[]> = {};
    allProgramAccounts.forEach(a => {
        const size = a.account.data.length;
        if (!sizeMap[size]) sizeMap[size] = [];
        sizeMap[size].push(a.pubkey.toBase58());
    });
    
    for (const size of Object.keys(sizeMap).map(Number)) {
        const pks = sizeMap[size];
        const inIndex = pks.filter(pk => indexedNodes.has(pk)).length;
        console.log(`Size ${size}: ${pks.length} accounts, ${inIndex} are in the global index.`);
    }
}
run().catch(console.error);
