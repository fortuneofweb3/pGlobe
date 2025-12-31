const { Connection, PublicKey } = require('@solana/web3.js');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const all = await conn.getProgramAccounts(DEVNET_PROGRAM, { filters: [{ dataSize: 1040 }] });
    const stats = {};
    all.forEach(a => {
        const d = a.account.data.slice(0, 8).toString('hex');
        const v = a.account.data[8];
        const key = `${d}:${v}`;
        stats[key] = (stats[key] || 0) + 1;
    });
    console.log(JSON.stringify(stats, null, 2));
}
run();
