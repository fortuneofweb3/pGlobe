
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

// Connection Setup
const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.solana.com';

const mainnetConnection = new Connection(MAINNET_RPC, 'confirmed');
const devnetConnection = new Connection(DEVNET_RPC, 'confirmed');

// The leaked JSON content
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

async function checkConnection(connection: Connection, label: string, pubkey: PublicKey) {
    console.log(`\nChecking ${label}...`);
    try {
        const balance = await connection.getBalance(pubkey);
        console.log(`[${label}] Balance: ${balance / 1e9} SOL`);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });

        console.log(`[${label}] Token Accounts: ${tokenAccounts.value.length}`);
        tokenAccounts.value.forEach(acc => {
            const info = acc.account.data.parsed.info;
            if (info.tokenAmount.uiAmount > 0) {
                console.log(`   - Mint: ${info.mint}`);
                console.log(`     Amount: ${info.tokenAmount.uiAmount}`);
            }
        });

    } catch (e: any) {
        console.log(`[${label}] Error: ${e.message}`);
    }
}

async function main() {
    console.log('Reconstructing Keypair...');

    // transform object values to array
    const secretKeyArray = Object.values(LEAKED_DATA._keypair.secretKey).map(Number);
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

    console.log(`LEAKED PUBLIC KEY: ${keypair.publicKey.toBase58()}`);
    console.log(`(This confirms the private key corresponds to this address)`);

    await checkConnection(mainnetConnection, 'MAINNET', keypair.publicKey);
    await checkConnection(devnetConnection, 'DEVNET', keypair.publicKey);
}

main();
