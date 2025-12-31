import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');

    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    console.log('=== FINAL ATTEMPT: Checking derived/combined values ===\n');

    // Maybe milestone is: byte8 % 30, or price / some_constant, or some formula
    const formulas = [
        { name: 'byte8 % 30', calc: (d: Buffer) => d[8] % 30 },
        { name: 'byte8 % 31', calc: (d: Buffer) => d[8] % 31 },
        { name: 'byte9 % 30', calc: (d: Buffer) => d[9] % 30 },
        { name: '(byte8 + byte9) % 30', calc: (d: Buffer) => (d[8] + d[9]) % 30 },
        { name: 'price / 2000', calc: (d: Buffer) => Math.floor(d.readUInt16LE(34) / 2000) },
        { name: 'price / 1000', calc: (d: Buffer) => Math.floor(d.readUInt16LE(34) / 1000) },
        { name: 'disc[7] % 30', calc: (d: Buffer) => d[7] % 30 },
        { name: 'disc[6] % 30', calc: (d: Buffer) => d[6] % 30 },
        { name: 'offset40 byte', calc: (d: Buffer) => d[40] },
        { name: 'offset41 byte', calc: (d: Buffer) => d[41] },
        { name: 'u32 at 32', calc: (d: Buffer) => d.readUInt32LE(32) },
    ];

    for (const formula of formulas) {
        const values = new Map<number, number>();

        for (const acc of accounts) {
            try {
                const val = formula.calc(acc.account.data);
                if (val >= 0 && val <= 50) {  // Reasonable range
                    values.set(val, (values.get(val) || 0) + 1);
                }
            } catch {
                continue;
            }
        }

        const inRange = Array.from(values.keys()).filter(v => v >= 1 && v <= 30).length;
        const distribution = values.size;

        if (inRange > 5 && distribution <= 30) {  // Has multiple values in range 1-30
            console.log(`\n${formula.name}:`);
            const sorted = Array.from(values.entries()).sort((a, b) => a[0] - b[0]);
            sorted.slice(0, 15).forEach(([val, count]) => {
                console.log(`  ${val}: ${count} nodes`);
            });
            if (sorted.length > 15) console.log(`  ... and ${sorted.length - 15} more`);
        }
    }

    console.log('\n\n=== Checking first 100 bytes raw for ANY field with 2-30 unique values ===');
    for (let offset = 0; offset < 100; offset++) {
        const values = new Set();
        for (const acc of accounts) {
            values.add(acc.account.data[offset]);
        }

        if (values.size >= 2 && values.size <= 30) {
            console.log(`Offset ${offset}: ${values.size} unique values - ${Array.from(values).sort((a: any, b: any) => a - b).join(',')}`);
        }
    }
}

run().catch(console.error);
