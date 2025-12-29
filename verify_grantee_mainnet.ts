
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TARGET_WALLET = new PublicKey('6yLuE8DJJvTTGhrXTZfbhdAkkr1rMSsvbFF9bHAfthyk');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

async function verify() {
    console.log(`Checking Mainnet for KNOWN Grantee: ${TARGET_WALLET.toBase58()}`);
    const connection = new Connection(MAINNET_RPC_URL, 'confirmed');

    const balance = await connection.getBalance(TARGET_WALLET);
    console.log(`SOL Balance: ${balance / 1e9}`);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(TARGET_WALLET, { mint: XAND_MINT });
    if (tokenAccounts.value.length > 0) {
        console.log(`✅ MATCH! XAND Balance: ${tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount}`);
    } else {
        console.log('No XAND.');
    }
}
verify().catch(console.error);
