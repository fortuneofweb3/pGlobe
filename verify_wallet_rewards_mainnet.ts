
import { Connection, PublicKey } from '@solana/web3.js';

// Public Solana Mainnet RPC
const MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TARGET_WALLET = new PublicKey('6iABQ7kVxG1KMaj4sCwWjabEbADDSShsnZmrWKhywc63');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

async function verifyMainnetRewards() {
    console.log(`Checking Mainnet transactions for wallet: ${TARGET_WALLET.toBase58()}`);
    const connection = new Connection(MAINNET_RPC_URL, 'confirmed');

    try {
        // 1. Check SOL Balance
        const balance = await connection.getBalance(TARGET_WALLET);
        console.log(`Mainnet SOL Balance: ${balance / 1e9} SOL`);

        // 2. Check XAND Token Balance
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(TARGET_WALLET, {
            mint: XAND_MINT
        });

        if (tokenAccounts.value.length > 0) {
            const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            console.log(`✅ MATCH! XAND Balance on Mainnet: ${amount} XAND`);
        } else {
            console.log('No XAND token account found on Mainnet.');
        }

        // 3. Check Recent Transactions for Inactivity
        const signatures = await connection.getSignaturesForAddress(TARGET_WALLET, { limit: 10 });
        console.log(`Found ${signatures.length} recent transactions.`);
        if (signatures.length > 0) {
            console.log(`Last transaction: ${new Date(signatures[0].blockTime! * 1000).toISOString()}`);
        }

    } catch (e) {
        console.error('Error fetching Mainnet data:', e);
    }
}

verifyMainnetRewards().catch(console.error);
