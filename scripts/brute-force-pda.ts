
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

// Captured Pairs from Mainnet
const PAIRS = [
    { wallet: new PublicKey('D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2'), target: 'GzxfwyaZGVznopYW2UNiYcgyxfUR4YjH1mYr8hbiduRC' },
    { wallet: new PublicKey('F4XJsyo3gfDfrLMNoC3q3jpTWzF2vx8ntVJX9F2PLj5X'), target: 'DiudQhfGbJ3gebqFev3CjY1X6CaPNnNs5Vecdw6mSjD' }
];

const SEEDS = [
    'config', 'fee', 'fees', 'state', 'global', 'pool', 'bank', 'vault',
    'treasury', 'admin', 'auth', 'authority', 'pnode', 'node', 'member',
    'user', 'payer', 'payment', 'register', 'registry', 'registrar',
    'info', 'settings', 'dao', 'mainnet', 'xandeum', 'data', 'store',
    'storage', 'reward', 'rewards', 'staking', 'stake', 'mint', 'token',
    'metadata', 'program', 'system', 'sysvar', 'rent', 'epoch', 'clock',
    'v1', 'v2', '1', '0', 'test', 'dev', 'beta', 'launch', 'genesis'
];

function checkWithBump(name: string, seeds: Buffer[], target: string) {
    try {
        // Canonical (findProgramAddress)
        const [pda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
        if (pda.toBase58() === target) {
            console.log(`✅ MATCH FOUND (Canonical, ${target})!`);
            console.log(`Seeds: [${name}]`);
            process.exit(0);
        }

        // Iterate Bumps (createProgramAddress)
        for (let b = 255; b >= 0; b--) {
            try {
                const pda2 = PublicKey.createProgramAddressSync([...seeds, Buffer.from([b])], PROGRAM_ID);
                if (pda2.toBase58() === target) {
                    console.log(`✅ MATCH FOUND (Bump ${b}, ${target})!`);
                    console.log(`Seeds: [${name}]`);
                    process.exit(0);
                }
            } catch (e) { }
        }
    } catch (e) { }
}

console.log(`Cracking seeds for ${PAIRS.length} pairs...`);

for (const pair of PAIRS) {
    const WALLET = pair.wallet;
    const TARGET = pair.target;
    console.log(`Testing Wallet: ${WALLET.toBase58()} -> Target: ${TARGET}`);

    // 1. Single seeds
    for (const s of SEEDS) {
        checkWithBump(`"${s}"`, [Buffer.from(s)], TARGET);
    }

    // 2. Seed + Wallet
    for (const s of SEEDS) {
        checkWithBump(`"${s}", wallet`, [Buffer.from(s), WALLET.toBuffer()], TARGET);
    }

    // 3. Wallet + Seed
    for (const s of SEEDS) {
        checkWithBump(`wallet, "${s}"`, [WALLET.toBuffer(), Buffer.from(s)], TARGET);
    }

    // 4. Nested Variations
    for (const s of SEEDS) {
        checkWithBump(`"config", "${s}"`, [Buffer.from("config"), Buffer.from(s)], TARGET);
        checkWithBump(`"state", "${s}"`, [Buffer.from("state"), Buffer.from(s)], TARGET);
        checkWithBump(`"fee", "${s}"`, [Buffer.from("fee"), Buffer.from(s)], TARGET);
    }

    // 5. Instruction data / Hardcoded
    checkWithBump(`[7]`, [Buffer.from([7])], TARGET);

    // 6. Numeric
    const NUMS = [0, 1, 2, 3, 7, 255];
    for (const s of SEEDS) {
        for (const n of NUMS) {
            checkWithBump(`"${s}", [${n}]`, [Buffer.from(s), Buffer.from([n])], TARGET);
            // Also Wallet + Seed + Num
            checkWithBump(`wallet, "${s}", [${n}]`, [WALLET.toBuffer(), Buffer.from(s), Buffer.from([n])], TARGET);
        }
    }
    // 7. Dependency: Account 1 derived from Account 2 ("owner" PDA)
    const [ownerPDA] = PublicKey.findProgramAddressSync([Buffer.from("owner"), WALLET.toBuffer()], PROGRAM_ID);
    checkWithBump(`"owner_pda"`, [ownerPDA.toBuffer()], TARGET);

    for (const s of SEEDS) {
        checkWithBump(`"${s}", owner_pda`, [Buffer.from(s), ownerPDA.toBuffer()], TARGET);
        checkWithBump(`owner_pda, "${s}"`, [ownerPDA.toBuffer(), Buffer.from(s)], TARGET);
    }

    // 8. Just Wallet
    checkWithBump(`wallet`, [WALLET.toBuffer()], TARGET);

    // 9. Miner/Validator specific
    const EXTRA_SEEDS = ['miner', 'validator', 'bucket', 'vault', 'bank'];
    for (const s of EXTRA_SEEDS) {
        checkWithBump(`"${s}", wallet`, [Buffer.from(s), WALLET.toBuffer()], TARGET);
    }
}
console.log("❌ No match found.");
