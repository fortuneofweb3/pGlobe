import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) {
        console.log('No index account');
        return;
    }
    const pubkeys: PublicKey[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i + 32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') pubkeys.push(pk);
    }
    console.log(`Checking ${pubkeys.length} nodes...`);
    const eras: Record<number, number> = {};
    const nonEra1Nodes: any[] = [];
    const priceRange: { min: number, max: number } = { min: Infinity, max: -Infinity };

    for (let i = 0; i < pubkeys.length; i += 100) {
        const batch = pubkeys.slice(i, i + 100);
        const pdas = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('registry'), pk.toBuffer()], DEVNET_PROGRAM)[0]);
        const infos = await conn.getMultipleAccountsInfo(pdas);

        infos.forEach((info, idx) => {
            if (!info) return;
            const era = info.data.readUInt16LE(32);
            const price = Number(info.data.readBigUInt64LE(34)) / 1e9;

            eras[era] = (eras[era] || 0) + 1;
            if (price < priceRange.min) priceRange.min = price;
            if (price > priceRange.max) priceRange.max = price;

            if (era !== 1) {
                nonEra1Nodes.push({ pubkey: batch[idx].toBase58(), era, price });
            }
        });

        if (i % 500 === 0) console.log(`  Progress: ${i}/${pubkeys.length}...`);
    }

    console.log('\n=== GLOBAL RESULTS ===');
    console.log('Total nodes indexed:', pubkeys.length);
    console.log('Eras distribution:', eras);
    console.log('Price range:', priceRange.min.toFixed(4), '-', priceRange.max.toFixed(4), 'SOL');

    if (nonEra1Nodes.length > 0) {
        console.log('\nFound nodes NOT in Era 1:');
        nonEra1Nodes.forEach(n => console.log(`- ${n.pubkey}: Era ${n.era}, Price ${n.price.toFixed(4)} SOL`));
    } else {
        console.log('\nNo nodes found outside Era 1 in the index.');
    }
}
run().catch(err => console.error(err));
