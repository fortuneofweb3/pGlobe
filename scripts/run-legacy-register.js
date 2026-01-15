
const fs = require('fs');
const path = require('path');
const { registerPNode } = require('../XandeumRepos/xandminerd/src/transactions.js');
const { Keypair } = require('@solana/web3.js');

async function main() {
    console.log("🔵 RUNNING LEGACY REGISTRATION...");

    // 1. Mock the keypair file structure expected by transactions.js
    // It expects "./keypairs/pnode-keypair.json" relative to CWD?
    // transactions.js: const KEYPAIR_DIR = "./keypairs";
    // It runs from CWD.

    if (!fs.existsSync('./keypairs')) {
        fs.mkdirSync('./keypairs');
    }

    // Load our devnet wallet or create one
    let secret;
    if (fs.existsSync('devnet-wallet.json')) {
        secret = JSON.parse(fs.readFileSync('devnet-wallet.json', 'utf8'));
    } else {
        const kp = Keypair.generate();
        secret = Array.from(kp.secretKey);
        fs.writeFileSync('devnet-wallet.json', JSON.stringify(secret));
    }

    // Write to pnode-keypair.json
    const kpJson = { privateKey: secret };
    fs.writeFileSync('./keypairs/pnode-keypair.json', JSON.stringify(kpJson));

    const wallet = Keypair.fromSecretKey(new Uint8Array(secret));
    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

    try {
        const result = await registerPNode(wallet.publicKey.toBase58());
        console.log("RESULT:", result);
    } catch (e) {
        console.error("CRITICAL FAILURE:", e);
    }
}

main();
