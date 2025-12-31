import { Connection, PublicKey } from '@solana/web3.js';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
async function run() {
    const conn = new Connection(DEVNET_RPC);
    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 34 }]
    });
    console.log(`Found ${accounts.length} 34-byte accounts.`);
    accounts.slice(0, 5).forEach(a => {
        const data = a.account.data;
        // Skip first 2 bytes if they look like a discriminator
        const era = data.readUInt16LE(0);
        const wallet = new PublicKey(data.slice(2)).toBase58();
        console.log(`- ${a.pubkey.toBase58()}: Era(?) ${era}, Wallet: ${wallet}`);
    });
}
run().catch(console.error);
