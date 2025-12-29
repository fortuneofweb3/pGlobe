
import { PublicKey } from '@solana/web3.js';

const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const WALLET = new PublicKey('5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W');
const EXPECTED_PDA = new PublicKey('8VxLopT96jGjwhNsiqckyv2PbdPLQqttn58YbGm2n6xX');

const seeds = [
    ['manager', WALLET],
    ['registry', WALLET],
    ['pnode', WALLET],
    ['reward', WALLET],
    ['claim', WALLET],
    ['user', WALLET],
    [WALLET],
    ['staker', WALLET],
    ['stake', WALLET],
];

console.log(`Trying to derive PDA for wallet ${WALLET.toBase58()}...`);
console.log(`Expected PDA: ${EXPECTED_PDA.toBase58()}\n`);

for (const seedParts of seeds) {
    try {
        const buffers = seedParts.map(s => {
            if (s instanceof PublicKey) return s.toBuffer();
            return Buffer.from(s);
        });
        const [pda, bump] = PublicKey.findProgramAddressSync(buffers, MAINNET_PROGRAM);
        const match = pda.equals(EXPECTED_PDA);
        console.log(`Seeds: [${seedParts.map(s => s instanceof PublicKey ? 'wallet' : `"${s}"`).join(', ')}]`);
        console.log(`   PDA: ${pda.toBase58()}`);
        console.log(`   Match: ${match ? '✅ YES!' : '❌ No'}`);
        if (match) {
            console.log(`\n🎉 FOUND DERIVATION: Seeds = [${seedParts.map(s => s instanceof PublicKey ? 'wallet' : `"${s}"`).join(', ')}]`);
            break;
        }
    } catch (e) {
        console.log(`Seeds: [${seedParts}] - Error: ${e}`);
    }
}
