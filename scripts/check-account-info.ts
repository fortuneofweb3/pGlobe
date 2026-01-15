
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const ACCOUNTS = [
    'GzxfwyaZGVznopYW2UNiYcgyxfUR4YjH1mYr8hbiduRC',
    'DiudQhfGbJ3gebqFev3CjY1X6CaPNnNs5Vecdw6mSjD'
];

async function main() {
    const conn = new Connection(RPC_URL, 'confirmed');
    console.log('Inspecting captured Account 1s...');

    for (const keyStr of ACCOUNTS) {
        const key = new PublicKey(keyStr);
        const info = await conn.getAccountInfo(key);
        console.log(`\nKey: ${keyStr}`);
        if (!info) {
            console.log('  ❌ Account not found!');
            continue;
        }
        console.log(`  Owner: ${info.owner.toBase58()}`);
        console.log(`  Data Size: ${info.data.length} bytes`);
        console.log(`  Executable: ${info.executable}`);
        console.log(`  Lamports: ${info.lamports}`);

        // If owner is Token Program, decode mint
        const TOKEN_PROG = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        if (info.owner.toBase58() === TOKEN_PROG && info.data.length === 165) {
            const mint = new PublicKey(info.data.slice(0, 32));
            const owner = new PublicKey(info.data.slice(32, 64));
            console.log(`  Type: Token Account`);
            console.log(`  Mint: ${mint.toBase58()}`);
            console.log(`  Owner: ${owner.toBase58()}`);
        }
    }
}

main();
