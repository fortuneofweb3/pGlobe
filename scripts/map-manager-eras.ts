import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    
    const nodePubkeys: PublicKey[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32));
        if (pk.toBase58() !== '11111111111111111111111111111111') nodePubkeys.push(pk);
    }
    
    console.log(`Mapping ${nodePubkeys.length} nodes to manager eras...`);
    const managerEraCounts: Record<number, number> = {};
    const nodesInOtherEras: any[] = [];

    for (let i = 0; i < nodePubkeys.length; i += 50) {
        const batch = nodePubkeys.slice(i, i + 50);
        const managerAddrs = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('manager'), pk.toBuffer()], DEVNET_PROGRAM)[0]);
        const manAccs = await conn.getMultipleAccountsInfo(managerAddrs);
        
        manAccs.forEach((man, idx) => {
            if (!man) return;
            const era = man.data.readUInt16LE(32);
            managerEraCounts[era] = (managerEraCounts[era] || 0) + 1;
            if (era !== 1) {
                nodesInOtherEras.push({ pubkey: batch[idx].toBase58(), era });
            }
        });
    }

    console.log('\nManager Era Distribution:');
    console.log(managerEraCounts);
    
    if (nodesInOtherEras.length > 0) {
        console.log('\nExample Nodes in other eras:');
        nodesInOtherEras.slice(0, 10).forEach(n => console.log(`- ${n.pubkey}: Era ${n.era}`));
    }
}
run().catch(console.error);
