const { Connection, PublicKey } = require('@solana/web3.js');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    const pks = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32));
        if (pk.toBase58() !== '11111111111111111111111111111111') pks.push(pk.toBase58());
    }
    const targets = pks.slice(0, 5).concat(pks.slice(-5)).concat(['HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC']);
    for (const node of targets) {
        const [regPda] = PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        const [manPda] = PublicKey.findProgramAddressSync([Buffer.from('manager'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        const r = await conn.getAccountInfo(regPda);
        const m = await conn.getAccountInfo(manPda);
        console.log(`Node: ${node}`);
        console.log(`  Registry: ${r ? r.data.slice(0,8).toString('hex') : 'NF'} B8: ${r ? r.data[8] : 'NF'} Era32: ${r ? r.data.readUInt16LE(32) : 'NF'}`);
        console.log(`  Manager: ${m ? m.data.readUInt16LE(32) : 'NF'}`);
    }
}
run();
