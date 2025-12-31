const { Connection, PublicKey } = require('@solana/web3.js');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const nodes = [
        'EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL', // Old
        'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC'  // New
    ];
    for (const node of nodes) {
        const [regPda] = PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        const r = await conn.getAccountInfo(regPda);
        console.log(`\nNODE: ${node}`);
        if (r) {
            console.log('Hex Data (First 128 bytes):');
            for (let i = 0; i < 128; i += 16) {
                console.log(`${i.toString(10).padStart(3, '0')}: ${r.data.slice(i, i+16).toString('hex')}`);
            }
        }
    }
}
run();
