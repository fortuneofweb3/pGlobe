import { Connection, PublicKey } from '@solana/web3.js';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    const target = 'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC';
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32)).toBase58();
        if (pk === target) {
            console.log('TARGET POSITION:', i/32);
            return;
        }
    }
    console.log('TARGET NOT FOUND');
}
run();
