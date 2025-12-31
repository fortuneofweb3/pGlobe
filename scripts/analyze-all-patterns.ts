import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');

    // Get ALL 1040-byte accounts and dump comprehensive data
    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    console.log(`Found ${accounts.length} registry accounts\n`);

    // Group by different byte patterns to find era correlation
    const patterns = new Map<string, any[]>();

    for (const acc of accounts) {
        const data = acc.account.data;

        // Create a "pattern signature" from potentially relevant bytes
        const pattern = [
            data[8],          // Byte 8
            data.readUInt16LE(32), // Offset 32
            data.readUInt16LE(34), // Price
        ].join('-');

        if (!patterns.has(pattern)) {
            patterns.set(pattern, []);
        }

        patterns.get(pattern)!.push({
            pubkey: acc.pubkey.toBase58(),
            byte8: data[8],
            offset32: data.readUInt16LE(32),
            price: data.readUInt16LE(34),
            disc: data.slice(0, 8).toString('hex'),
        });
    }

    console.log(`Found ${patterns.size} unique patterns\n`);

    // Show all patterns sorted by price (proxy for era)
    const sortedPatterns = Array.from(patterns.entries()).sort((a, b) => {
        const priceA = a[1][0].price;
        const priceB = b[1][0].price;
        return priceB - priceA; // Descending (oldest = highest price)
    });

    console.log('Patterns (sorted by price, highest=oldest):');
    for (const [pattern, nodes] of sortedPatterns.slice(0, 30)) { // Show first 30
        const sample = nodes[0];
        console.log(`Pattern ${pattern}: ${nodes.length} nodes`);
        console.log(`  Byte8=${sample.byte8}, Offset32=${sample.offset32}, Price=${sample.price}`);
        console.log(`  Sample disc: ${sample.disc}`);
    }
}

run().catch(console.error);
