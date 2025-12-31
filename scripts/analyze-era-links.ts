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
    
    console.log(`Analyzing ${nodePubkeys.length} nodes...`);
    
    for (let i = 0; i < nodePubkeys.length; i += 50) {
        const batch = nodePubkeys.slice(i, i + 50);
        const registryAddrs = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('registry'), pk.toBuffer()], DEVNET_PROGRAM)[0]);
        const managerAddrs = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('manager'), pk.toBuffer()], DEVNET_PROGRAM)[0]);
        
        const regAccs = await conn.getMultipleAccountsInfo(registryAddrs);
        const manAccs = await conn.getMultipleAccountsInfo(managerAddrs);
        
        regAccs.forEach((reg, idx) => {
            if (!reg) return;
            const man = manAccs[idx];
            
            const regEra = reg.data.readUInt16LE(32);
            const regPrice = Number(reg.data.readBigUInt64LE(34)) / 1e9;
            
            let manEra = 'N/A';
            if (man) {
                manEra = man.data.readUInt16LE(32).toString();
            }
            
            if (regEra !== 1 || (man && man.data.readUInt16LE(32) !== 1)) {
                console.log(`Node ${batch[idx].toBase58().slice(0,8)}: RegEra=${regEra}, ManEra=${manEra}, Price=${regPrice.toFixed(4)}`);
            }
        });
    }
}
run().catch(console.error);
