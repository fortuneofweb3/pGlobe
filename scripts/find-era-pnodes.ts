import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    
    const nodes: string[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32));
        if (pk.toBase58() !== '11111111111111111111111111111111') nodes.push(pk.toBase58());
    }
    
    console.log(`Scanning manager PDAs for ${nodes.length} nodes...`);
    
    for (let i = 0; i < nodes.length; i += 50) {
        const batch = nodes.slice(i, i + 50);
        const managerPDAs = batch.map(pk => 
            PublicKey.findProgramAddressSync([Buffer.from('manager'), new PublicKey(pk).toBuffer()], DEVNET_PROGRAM)[0]
        );
        
        const infos = await conn.getMultipleAccountsInfo(managerPDAs);
        infos.forEach((info, idx) => {
            if (!info) return;
            // Assuming Era ID is at 32 in Manager account too
            const era = info.data.readUInt16LE(32);
            if (era !== 1) {
                console.log(`Found node in Era ${era}: ${batch[idx]}`);
            }
        });
    }
}
run().catch(console.error);
