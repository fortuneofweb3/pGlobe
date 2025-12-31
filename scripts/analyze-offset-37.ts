import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    console.log('=== ANALYZING OFFSET 37 (3 unique values) ===\n');
    const groups = new Map<number, any[]>();

    for (const acc of accounts) {
        const val = acc.account.data[37];
        if (!groups.has(val)) groups.set(val, []);

        groups.get(val)!.push({
            pubkey: acc.pubkey.toBase58(),
            price: acc.account.data.readUInt16LE(34),
            byte8: acc.account.data[8],
            offset32: acc.account.data.readUInt16LE(32),
            bytes36_40: acc.account.data.slice(36, 41).toString('hex'),
        });
    }

    for (const [val, nodes] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
        const prices = nodes.map(n => n.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        console.log(`\nValue ${val}: ${nodes.length} nodes`);
        console.log(`  Price range: ${minPrice} - ${maxPrice} (avg: ${Math.round(avgPrice)})`);
        console.log(`  Sample bytes 36-40: ${nodes.slice(0, 3).map(n => n.bytes36_40).join(', ')}`);
        console.log(`  Sample pubkeys: ${nodes.slice(0, 2).map(n => n.pubkey).join(', ')}`);
    }

    console.log('\n\n=== CHECKING IF OFFSET 37 CORRELATES WITH PRICE BRACKETS ===');
    // If offset 37 represents era groups, higher values might = earlier eras (higher prices)
    const sortedByPrice = Array.from(groups.entries()).sort((a, b) => {
        const avgA = a[1].reduce((sum, n) => sum + n.price, 0) / a[1].length;
        const avgB = b[1].reduce((sum, n) => sum + n.price, 0) / b[1].length;
        return avgB - avgA;
    });

    sortedByPrice.forEach(([val, nodes], idx) => {
        const avgPrice = nodes.reduce((sum, n) => sum + n.price, 0) / nodes.length;
        console.log(`Group ${idx + 1} (value ${val}): Avg price ${Math.round(avgPrice)}`);
    });
}

run().catch(console.error);
