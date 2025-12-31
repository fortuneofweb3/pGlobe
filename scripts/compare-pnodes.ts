import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    
    const pks: string[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32)).toBase58();
        if (pk !== '11111111111111111111111111111111') pks.push(pk);
    }
    
    console.log(`Found ${pks.length} nodes in index.`);
    
    const first5 = pks.slice(0, 5);
    const last5 = pks.slice(-5);
    
    const allToCompare = [...first5, ...last5, 'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC'];
    
    for (const node of allToCompare) {
        const [regPda] = PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        const [manPda] = PublicKey.findProgramAddressSync([Buffer.from('manager'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        
        const [reg, man] = await Promise.all([
            conn.getAccountInfo(regPda),
            conn.getAccountInfo(manPda)
        ]);
        
        console.log(`\nNode: ${node}`);
        if (reg) {
            console.log(`  Registry (1040): Disc=${reg.data.slice(0,8).toString('hex')}, B8=${reg.data[8]}, Era32=${reg.data.readUInt16LE(32)}`);
        } else {
            console.log(`  Registry: NOT FOUND`);
        }
        if (man) {
            console.log(`  Manager (34): Era32=${man.data.readUInt16LE(32)}`);
        } else {
            console.log(`  Manager: NOT FOUND`);
        }
    }
}
run().catch(console.error);
