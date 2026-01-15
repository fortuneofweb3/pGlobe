
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const USERS = [
    {
        name: 'D7Tm',
        wallet: new PublicKey('D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2'),
        acc1: 'GzxfwyaZGVznopYW2UNiYcgyxfUR4YjH1mYr8hbiduRC',
        mints: ['CstmthY9j8yU8dYbX2vngC44yAKkRi9CW68w55Hk7UKW', 'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx']
    },
    {
        name: 'F4XJ',
        wallet: new PublicKey('F4XJsyo3gfDfrLMNoC3q3jpTWzF2vx8ntVJX9F2PLj5X'),
        acc1: 'DiudQhfGbJ3gebqFev3CjY1X6CaPNnNs5Vecdw6mSjD',
        mints: ['6sCpM7bRPTKPJXXugQF1PV4Qk5krjvsNBu4EfFFPWM8w', 'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx', '9se94v3wVJsHSaheRrgaofPudXvCwPTa9yyjhP3HfCFK']
    }
];

const SEEDS = [
    'node', 'pnode', 'license', 'nft', 'metadata', 'staking', 'stake', 'cpi', 'auth', 'record', 'member'
];

function check(name: string, seeds: Buffer[], target: string) {
    try {
        const [pda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
        if (pda.toBase58() === target) {
            console.log(`✅ MATCH FOUND (${target})!`);
            console.log(`  Seeds: [${name}]`);
            process.exit(0);
        }
    } catch (e) { }
}

console.log("Checking derivations from Mints...");

for (const user of USERS) {
    console.log(`\nUser ${user.name}:`);
    const acc1 = user.acc1;

    for (const mintStr of user.mints) {
        const mint = new PublicKey(mintStr);
        // console.log(`  Checking Mint: ${mintStr}`);

        // 1. [Seed, Mint]
        for (const s of SEEDS) {
            check(`"${s}", mint`, [Buffer.from(s), mint.toBuffer()], acc1);
        }
        // 2. [Mint, Seed]
        for (const s of SEEDS) {
            check(`mint, "${s}"`, [mint.toBuffer(), Buffer.from(s)], acc1);
        }
        // 3. [Mint]
        check(`mint`, [mint.toBuffer()], acc1);

        // 4. [Seed, Wallet, Mint]
        for (const s of SEEDS) {
            check(`"${s}", wallet, mint`, [Buffer.from(s), user.wallet.toBuffer(), mint.toBuffer()], acc1);
        }
    }
}
console.log("❌ No match found.");
