
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const CONNECTION = new Connection(HELIUS_RPC, 'confirmed');

const GHOST_NODES = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

async function main() {
    console.log(`Analyzing ${GHOST_NODES.length} ghost nodes via Helius...`);

    for (const pubkeyStr of GHOST_NODES) {
        console.log(`\n==================================================`);
        console.log(`Target: ${pubkeyStr}`);
        const pubkey = new PublicKey(pubkeyStr);

        // 1. Check Account Info (Owner & Lamports)
        try {
            const info = await CONNECTION.getAccountInfo(pubkey);
            if (info) {
                console.log(`✅ Account Exists!`);
                console.log(`   - Owner: ${info.owner.toBase58()}`);
                console.log(`   - Balance: ${info.lamports / 1e9} SOL`);
                console.log(`   - Data Size: ${info.data.length} bytes`);
                console.log(`   - Executable: ${info.executable}`);

                // If owned by System Program, it's a regular wallet (or uninitialized)
                if (info.owner.toBase58() === '11111111111111111111111111111111') {
                    console.log(`   -> TYPE: Regular System Account (Wallet)`);
                } else {
                    console.log(`   -> TYPE: Program Derived Address (PDA) or Program Account`);
                    console.log(`   -> Managed by: ${info.owner.toBase58()}`);
                }

            } else {
                console.log(`❌ Account does not exist (never funded or initialized)`);
            }
        } catch (e: any) {
            console.log(`❌ Error fetching account info: ${e.message}`);
        }

        // 2. Fetch Transaction History
        try {
            console.log(`\n   --- Transaction History (Last 10) ---`);
            const signatures = await CONNECTION.getSignaturesForAddress(pubkey, { limit: 10 });

            if (signatures.length === 0) {
                console.log(`   (No transactions found)`);
            }

            for (const sig of signatures) {
                const date = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'Unknown Date';
                console.log(`   [${date}] ${sig.signature} ${sig.err ? '(FAILED)' : ''}`);

                // Deep dive into one recent tx if possible
                if (signatures.indexOf(sig) === 0) {
                    console.log(`      -> Analyzying latest tx...`);
                    const tx = await CONNECTION.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (tx) {
                        const Instructions = tx.transaction.message.instructions.map((ix: any) => {
                            if (ix.programId) return ix.programId.toBase58();
                            return 'Unknown Program';
                        });
                        console.log(`      -> Programs involved: ${[...new Set(Instructions)].join(', ')}`);
                    }
                }
            }
        } catch (e: any) {
            console.log(`❌ Error fetching history: ${e.message}`);
        }
    }
}

main().catch(console.error);
