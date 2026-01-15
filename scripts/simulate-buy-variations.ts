
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const WALLET_FILE = 'wallet.json';

// Candidates for Account 1
const CANDIDATES = [
    { name: 'Observed (79xFA...)', key: new PublicKey('79xFAcGDxD8vcPy1uW55BajrsucToShRU8JDinVXkXFN') },
    { name: 'Derived ["config"]', key: PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0] },
    { name: 'Derived ["state"]', key: PublicKey.findProgramAddressSync([Buffer.from("state")], PROGRAM_ID)[0] },
    { name: 'Derived ["fee"]', key: PublicKey.findProgramAddressSync([Buffer.from("fee")], PROGRAM_ID)[0] },
    { name: 'Derived ["global"]', key: PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM_ID)[0] },
    { name: 'Derived ["treasury"]', key: PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID)[0] },
];

async function main() {
    console.log("🔵 SIMULATING PURCHASE VARIATIONS...");
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load Wallet
    const walletPath = path.resolve(process.cwd(), WALLET_FILE);
    const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(secret));

    // Owner PDA
    const [ownerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("owner"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
    );

    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`Owner PDA: ${ownerPDA.toBase58()}`);

    // Fetch ALL program accounts
    console.log(`Fetching all program accounts...`);
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${allAccounts.length} accounts. Simulating each as Account 1...`);

    let passed = false;
    for (const acc of allAccounts) {
        // Skip obvious wrong sizes if we want optimization, but let's try all
        if (acc.account.data.length !== 48) continue; // Optimization based on 79xFA size

        const candidateKey = acc.pubkey;
        process.stdout.write(`Trying ${candidateKey.toBase58()}... `);

        const keys = [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: candidateKey, isSigner: false, isWritable: true },
            { pubkey: ownerPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        const instruction = new TransactionInstruction({
            keys,
            programId: PROGRAM_ID,
            data: Buffer.from([7]) // RegisterOwner
        });

        const tx = new Transaction().add(instruction);
        tx.feePayer = wallet.publicKey;
        // reuse blockhash or fetch new one very occasionally? 
        // fetching new one every time is slow. Let's fetch one globally.
    }

    // Optimized Loop with single blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    for (const acc of allAccounts) {
        if (acc.account.data.length !== 48) continue;
        const candidateKey = acc.pubkey;

        const keys = [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: candidateKey, isSigner: false, isWritable: true },
            { pubkey: ownerPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        const tx = new Transaction().add(new TransactionInstruction({
            keys,
            programId: PROGRAM_ID,
            data: Buffer.from([7])
        }));
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = blockhash;

        try {
            const result = await connection.simulateTransaction(tx, [wallet]);
            if (!result.value.err) {
                console.log(`\n\n✅✅✅ JACKPOT! MATCH FOUND! ✅✅✅`);
                console.log(`Working Account 1: ${candidateKey.toBase58()}`);
                process.exit(0);
            }
        } catch (e) { }
    }

    console.log("\n❌ Tried all accounts. None worked.");
}

main();

