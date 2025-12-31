console.log('START');
import { Connection, PublicKey } from '@solana/web3.js';
async function run() {
    console.log('RUNNING');
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const acc = await conn.getAccountInfo(new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs'));
    console.log('INDEX LOADED:', acc?.data.length);
}
run();
