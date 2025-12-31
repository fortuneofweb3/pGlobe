import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');

    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    console.log(`Analyzing ${accounts.length} accounts for milestone field (1-30)\n`);

    // Check multiple byte positions for values in range 1-30
    const positions = [
        6, 7, 8, 9, 10, 11, 12, 13, 14, 15,  // Around discriminator area
        30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,  // Around price area
        74, 75, 76, 77, 78, 79, 80  // After manager wallet
    ];

    for (const pos of positions) {
        const values = new Map<number, number>();

        for (const acc of accounts) {
            const val = acc.account.data[pos];
            values.set(val, (values.get(val) || 0) + 1);
        }

        // Check if this position has values concentrated in 1-30 range
        const inRange = Array.from(values.keys()).filter(v => v >= 1 && v <= 30).length;
        const totalUnique = values.size;

        if (inRange > 0 && inRange === totalUnique) {
            // This position only has values 1-30!
            console.log(`\n** POTENTIAL MILESTONE at offset ${pos} **`);
            console.log(`All ${totalUnique} unique values are in range 1-30:`);
            const sorted = Array.from(values.entries()).sort((a, b) => a[0] - b[0]);
            sorted.forEach(([val, count]) => {
                console.log(`  Value ${val}: ${count} nodes`);
            });
        } else if (inRange >= totalUnique * 0.5) {
            console.log(`\nOffset ${pos}: ${inRange}/${totalUnique} values in 1-30 range`);
        }
    }

    // Also check u16 at various positions
    console.log('\n\n=== Checking u16 values ===');
    const u16Positions = [6, 8, 10, 30, 32, 34, 36, 38, 40, 74, 76];

    for (const pos of u16Positions) {
        const values = new Map<number, number>();

        for (const acc of accounts) {
            const val = acc.account.data.readUInt16LE(pos);
            values.set(val, (values.get(val) || 0) + 1);
        }

        const inRange = Array.from(values.keys()).filter(v => v >= 1 && v <= 30).length;
        const totalUnique = values.size;

        if (inRange > 0 && inRange === totalUnique) {
            console.log(`\n** POTENTIAL MILESTONE u16 at offset ${pos} **`);
            console.log(`All ${totalUnique} unique values are in range 1-30:`);
            const sorted = Array.from(values.entries()).sort((a, b) => a[0] - b[0]);
            sorted.forEach(([val, count]) => {
                console.log(`  Value ${val}: ${count} nodes`);
            });
        }
    }
}

run().catch(console.error);
