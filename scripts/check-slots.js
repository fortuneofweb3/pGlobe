const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.devnet.xandeum.com:8899');
async function run() {
    const nodes = [
        'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC',
        'EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL'
    ];
    for (const node of nodes) {
        // Registry PDA for program 6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL
        const [pda] = PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(node).toBuffer()], new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL'));
        const sigs = await conn.getSignaturesForAddress(pda, { limit: 10 });
        if (sigs.length > 0) {
            console.log(node, 'First Sig Slot:', sigs[sigs.length-1].slot);
        } else {
            console.log(node, 'No sigs');
        }
    }
}
run();
