
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Using public mainnet RPC
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const FEE_ACCOUNT = new PublicKey('79xFAcGDxD8vcPy1uW55BajrsucToShRU8JDinVXkXFN');
const WALLET_FILE = 'wallet.json';

// Minimal fee estimation (~0.025 SOL for registration + tx fees)
const REQUIRED_SOL = 0.03;

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0 && (e.message?.includes('429') || e.toString().includes('429'))) {
            console.log(`  Rate limited. Retrying in 2s... (${retries} left)`);
            await new Promise(r => setTimeout(r, 2000));
            return withRetry(fn, retries - 1);
        }
        throw e;
    }
}

async function main() {
    console.log(`\n🔵 INITIALIZING XANDEUM NODE PURCHASE...`);
    console.log(`Connecting to ${RPC_URL}...`);
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Load or Create Wallet
    let wallet: Keypair;
    const walletPath = path.resolve(process.cwd(), WALLET_FILE);

    if (fs.existsSync(walletPath)) {
        const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(secret));
        console.log(`✅ Loaded existing wallet: ${wallet.publicKey.toBase58()}`);
    } else {
        wallet = Keypair.generate();
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(wallet.secretKey)));
        console.log(`🆕 Created NEW wallet: ${wallet.publicKey.toBase58()}`);
        console.log(`   Saved to: ${walletPath}`);
    }

    // 2. Check Balance
    const lamports = await withRetry(() => connection.getBalance(wallet.publicKey));
    const solBalance = lamports / 1e9;
    console.log(`💰 Balance: ${solBalance.toFixed(4)} SOL`);

    if (solBalance < REQUIRED_SOL) {
        console.log(`\n⚠️  INSUFFICIENT FUNDS ⚠️`);
        console.log(`Please send at least ${REQUIRED_SOL} SOL to:`);
        console.log(`👉  ${wallet.publicKey.toBase58()}  👈`);
        console.log(`\nAfter sending, wait 10s and run this script again.`);
        return;
    }

    console.log(`✅ Funds detected. Proceeding to Purchase...`);

    // 3. Derive Owner PDA
    const [ownerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("owner"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
    );
    console.log(`Derived Owner PDA: ${ownerPDA.toBase58()}`);

    // 4. Construct Instruction
    const keys = [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: FEE_ACCOUNT, isSigner: false, isWritable: true },
        { pubkey: ownerPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
    ];

    const instructionData = Buffer.from([7]); // Instruction 07: RegisterOwner

    const instruction = new TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data: instructionData
    });

    const transaction = new Transaction().add(instruction);

    // Get latest blockhash
    console.log(`Fetching blockhash...`);
    const { blockhash } = await withRetry(() => connection.getLatestBlockhash());
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    try {
        console.log(`🚀 SENDING TRANSACTION...`);
        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

        console.log(`\n✅✅✅ PURCHASE SUCCESSFUL! ✅✅✅`);
        console.log(`Signature: https://solscan.io/tx/${signature}`);
        console.log(`Your Node is now REGISTERED!`);
        console.log(`Owner: ${wallet.publicKey.toBase58()}`);
    } catch (e: any) {
        console.error(`\n❌ Transaction Failed:`, e.message);
        if (e.logs) {
            console.log('Logs:');
            e.logs.forEach((log: string) => console.log(`  ${log}`));
        }
    }
}

main();
