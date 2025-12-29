
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function deriveFromIndex() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // Fetch all 48-byte PDAs
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const pdaSet = new Set(accounts.map(a => a.pubkey.toBase58()));
    console.log(`Loaded ${pdaSet.size} PDAs.\n`);

    // Try indices 0-200 with various seeds
    const seedPrefixes = ['pnode', 'staker', 'entry', 'user', 'claim', 'id'];

    for (const prefix of seedPrefixes) {
        console.log(`Trying seed prefix: "${prefix}"...`);
        let matchCount = 0;

        for (let i = 0; i < 200; i++) {
            const idxBuf = Buffer.alloc(8);
            idxBuf.writeBigUInt64LE(BigInt(i));

            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from(prefix), idxBuf],
                MAINNET_PROGRAM
            );

            if (pdaSet.has(pda.toBase58())) {
                matchCount++;
                if (matchCount <= 3) {
                    console.log(`   Index ${i}: ${pda.toBase58()} ✅`);
                }
            }
        }

        console.log(`   Total matches: ${matchCount}\n`);
        if (matchCount > 10) {
            console.log(`🎉 FOUND! Seed prefix "${prefix}" with u64 index derives the PDAs!`);
            break;
        }
    }
}

deriveFromIndex().catch(console.error);
