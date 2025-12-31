import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    
    // The index account seems to be a simple array of 32-byte pubkeys.
    // Early nodes should be at the BEGINNING of the account.
    const nodes: { pubkey: string, index: number }[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i + 32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            nodes.push({ pubkey: pk.toBase58(), index: i / 32 });
        }
    }
    
    console.log(`First 20 registered nodes (by index):`);
    const earlyNodes = nodes.slice(0, 20);
    const registryAddrs = earlyNodes.map(n => PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(n.pubkey).toBuffer()], DEVNET_PROGRAM)[0]);
    const registryAccs = await conn.getMultipleAccountsInfo(registryAddrs);
    
    registryAccs.forEach((r, i) => {
        if (!r) return;
        const era = r.data.readUInt16LE(32);
        const price = Number(r.data.readBigUInt64LE(34)) / 1e9;
        console.log(`- ${earlyNodes[i].pubkey.slice(0,8)} (Index ${earlyNodes[i].index}): Era=${era}, Price=${price.toFixed(4)} SOL`);
    });

    console.log(`\nLast 20 registered nodes (by index):`);
    const lateNodes = nodes.slice(-20);
    const lateRegistryAddrs = lateNodes.map(n => PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(n.pubkey).toBuffer()], DEVNET_PROGRAM)[0]);
    const lateRegistryAccs = await conn.getMultipleAccountsInfo(lateRegistryAddrs);
    
    lateRegistryAccs.forEach((r, i) => {
        if (!r) return;
        const era = r.data.readUInt16LE(32);
        const price = Number(r.data.readBigUInt64LE(34)) / 1e9;
        console.log(`- ${lateNodes[i].pubkey.slice(0,8)} (Index ${lateNodes[i].index}): Era=${era}, Price=${price.toFixed(4)} SOL`);
    });
}
run().catch(console.error);
