
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const TARGET_WALLETS = [
    'D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2',
    'F4XJsyo3gfDfrLMNoC3q3jpTWzF2vx8ntVJX9F2PLj5X'
];

async function main() {
    const conn = new Connection(RPC_URL, 'confirmed');

    for (const walletStr of TARGET_WALLETS) {
        console.log(`\nScanning tokens for: ${walletStr}`);
        const wallet = new PublicKey(walletStr);

        // Fetch all token accounts
        const accounts = await conn.getParsedTokenAccountsByOwner(wallet, {
            programId: TOKEN_PROGRAM_ID
        });

        console.log(`Found ${accounts.value.length} token accounts.`);

        for (const { account } of accounts.value) {
            const info = account.data.parsed.info;
            const amount = info.tokenAmount.uiAmount;
            const mint = info.mint;

            // Look for NFT-like things (amount 1, 0 decimals usually, but check all)
            if (amount > 0) {
                console.log(`  Mint: ${mint} | Amount: ${amount} | Decimals: ${info.tokenAmount.decimals}`);
            }
        }
    }
}

main();
