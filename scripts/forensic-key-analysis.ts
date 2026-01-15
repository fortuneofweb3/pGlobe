
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.solana.com';

const LEAKED_DATA = {
    "_keypair": {
        "publicKey": {
            "0": 221, "1": 191, "2": 38, "3": 162, "4": 231, "5": 2, "6": 152, "7": 96, "8": 92, "9": 156, "10": 184, "11": 251, "12": 107, "13": 16, "14": 252, "15": 217, "16": 150, "17": 67, "18": 78, "19": 39, "20": 52, "21": 166, "22": 65, "23": 248, "24": 217, "25": 39, "26": 183, "27": 86, "28": 90, "29": 198, "30": 30, "31": 244
        },
        "secretKey": {
            "0": 27, "1": 25, "2": 88, "3": 57, "4": 15, "5": 97, "6": 18, "7": 152, "8": 59, "9": 3, "10": 108, "11": 238, "12": 125, "13": 83, "14": 47, "15": 222, "16": 152, "17": 198, "18": 39, "19": 7, "20": 116, "21": 73, "22": 136, "23": 175, "24": 94, "25": 51, "26": 39, "27": 191, "28": 45, "29": 143, "30": 28, "31": 191, "32": 221, "33": 191, "34": 38, "35": 162, "36": 231, "37": 2, "38": 152, "39": 96, "40": 92, "41": 156, "42": 184, "43": 251, "44": 107, "45": 16, "46": 252, "47": 217, "48": 150, "49": 67, "50": 78, "51": 39, "52": 52, "53": 166, "54": 65, "55": 248, "56": 217, "57": 39, "58": 183, "59": 86, "60": 90, "61": 198, "62": 30, "63": 244
        }
    }
};

const secretKeyArray = Object.values(LEAKED_DATA._keypair.secretKey).map(Number);
const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
const PUBKEY = keypair.publicKey;

// Spl Governance Program ID (Generic) - Xandeum might use a specific instance
const REALM_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');

async function analyze(connection: Connection, label: string) {
    console.log(`\n=== Analyzing ${label} ===`);

    // 1. Balance
    const balance = await connection.getBalance(PUBKEY);
    console.log(`SOL Balance: ${balance / 1e9} SOL`);

    // 2. Token Accounts (All)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(PUBKEY, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });
    console.log(`Token Accounts: ${tokenAccounts.value.length}`);
    tokenAccounts.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        console.log(`  - Mint: ${info.mint} | Amount: ${info.tokenAmount.uiAmount}`);
    });

    // 3. Signatures (History)
    const signatures = await connection.getSignaturesForAddress(PUBKEY, { limit: 10 });
    console.log(`Transaction History (Last 10):`);
    if (signatures.length === 0) {
        console.log(`  No signatures found.`);
    } else {
        signatures.forEach(sig => {
            const date = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'Unknown Date';
            console.log(`  - ${date} | ${sig.signature} | Err: ${sig.err ? 'YES' : 'No'}`);
        });
    }

    // 4. Check for Governance / DAO Stakes (Generic search for accounts owned by Gov program where this key is owner)
    // This is hard without knowing the specific Realm or VoterRecord structure, but we can check if it holds any "realm" tokens or similar.
    // Usually stakes are in a VoterWeightRecord or similar PDA.
}

async function main() {
    console.log(`Target Key: ${PUBKEY.toBase58()}`);

    try {
        await analyze(new Connection(MAINNET_RPC, 'confirmed'), 'MAINNET');
    } catch (e: any) { console.log(`Mainnet Error: ${e.message}`); }

    try {
        await analyze(new Connection(DEVNET_RPC, 'confirmed'), 'DEVNET');
    } catch (e: any) { console.log(`Devnet Error: ${e.message}`); }

}

main();
