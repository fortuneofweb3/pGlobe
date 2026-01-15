
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGET_PUBKEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Connecting to ${HELIUS_RPC}...`);
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    console.log(`Fetching all accounts for program ${MAINNET_PROGRAM.toBase58()}...`);
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM);
    console.log(`Found ${accounts.length} accounts.`);

    // Group by size
    const bySize: Record<number, number> = {};
    for (const acc of accounts) {
        const len = acc.account.data.length;
        bySize[len] = (bySize[len] || 0) + 1;
    }
    console.log('Accounts by size:', bySize);

    console.log('\nChecking for target pubkeys in account data...');

    for (const target of TARGET_PUBKEYS) {
        let found = false;

        // 1. Check if any account is the Registry PDA for this target
        const [registryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), new PublicKey(target).toBuffer()],
            MAINNET_PROGRAM
        );

        const registryAccount = accounts.find(a => a.pubkey.toBase58() === registryPDA.toBase58());
        if (registryAccount) {
            console.log(`✅ MATCH! Registry PDA for ${target} exists! (Size: ${registryAccount.account.data.length})`);
            found = true;
        }

        // 2. Check if the pubkey is stored INSIDE any account data
        // Only if not found as PDA
        if (!found) {
            const targetBytes = new PublicKey(target).toBuffer();
            for (const acc of accounts) {
                if (acc.account.data.includes(targetBytes)) {
                    console.log(`⚠️  MATCH! Pubkey ${target} found inside account ${acc.pubkey.toBase58()} (Size: ${acc.account.data.length})`);
                    found = true;
                }
            }
        }

        if (!found) {
            console.log(`❌ ${target}: Not found in any program account.`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
