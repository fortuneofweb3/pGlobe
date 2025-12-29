
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const UNKNOWN_ACCOUNTS = [
    'E2jV5bsuxoUB5rXzwY4zcbNAT5nBJJ7Z1HxLwpgoqtVV',
    'CaGfz4CkN4otKGsC38r3GfxXAJKmkUSJaJSx6Bfh5Fnt',
];

async function inspect() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    for (const acc of UNKNOWN_ACCOUNTS) {
        console.log(`\nInspecting ${acc}...`);
        const pubkey = new PublicKey(acc);
        const info = await connection.getAccountInfo(pubkey);

        if (!info) {
            console.log('   Account does not exist!');
            continue;
        }

        console.log(`   Owner: ${info.owner.toBase58()}`);
        console.log(`   Executable: ${info.executable}`);
        console.log(`   Size: ${info.data.length} bytes`);
        console.log(`   Lamports: ${info.lamports}`);

        // If Token Program, decode as token account
        if (info.owner.toBase58() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
            console.log('   ^ This is a Token Account!');
            // Token account layout: mint (32), owner (32), amount (8), ...
            const mint = new PublicKey(info.data.slice(0, 32));
            const owner = new PublicKey(info.data.slice(32, 64));
            const amount = info.data.readBigUInt64LE(64);
            console.log(`   Mint: ${mint.toBase58()}`);
            console.log(`   Owner: ${owner.toBase58()}`);
            console.log(`   Amount: ${amount.toString()}`);
        }
    }
}

inspect().catch(console.error);
