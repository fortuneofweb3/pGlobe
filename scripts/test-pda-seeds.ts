import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const nodePk = new PublicKey('EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL');
    const seeds = ['registry', 'manager', 'purchase', 'registration', 'config', 'data', 'pnode', 'operator'];
    
    console.log(`Testing seeds for node ${nodePk.toBase58()}:`);
    
    for (const seed of seeds) {
        const [pda] = PublicKey.findProgramAddressSync([Buffer.from(seed), nodePk.toBuffer()], DEVNET_PROGRAM);
        const info = await conn.getAccountInfo(pda);
        if (info) {
            console.log(`- Seed "${seed}": Found account ${pda.toBase58()} (Size ${info.data.length})`);
            console.log(`  Hex: ${info.data.slice(0, 64).toString('hex')}`);
        } else {
            // console.log(`- Seed "${seed}": Not found`);
        }
    }
}
run().catch(console.error);
