
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
const FEE_ACCOUNT = new PublicKey('79xFAcGDxD8vcPy1uW55BajrsucToShRU8JDinVXkXFN');

async function main() {
    console.log("🔵 SIMULATING DATA VARIATIONS...");
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load Wallet
    const walletPath = path.resolve(process.cwd(), WALLET_FILE);
    const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(secret));

    // Owner PDA & Bump
    const [ownerPDA, canonicalBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("owner"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
    );

    console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`Owner PDA: ${ownerPDA.toBase58()} (Bump: ${canonicalBump})`);
    console.log(`Target Fee Account: ${FEE_ACCOUNT.toBase58()}`);

    const variations = [
        { name: 'Data [7]', data: Buffer.from([7]) },
        { name: `Data [7, ${canonicalBump}]`, data: Buffer.from([7, canonicalBump]) },
        { name: 'Data [7, 0]', data: Buffer.from([7, 0]) },
        { name: 'Data [7] + derived "config" acc', data: Buffer.from([7]), acc1: PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0] },
    ];

    const { blockhash } = await connection.getLatestBlockhash();

    for (const v of variations) {
        process.stdout.write(`Testing ${v.name}... `);

        const keys = [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: v.acc1 || FEE_ACCOUNT, isSigner: false, isWritable: true },
            { pubkey: ownerPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        const tx = new Transaction().add(new TransactionInstruction({
            keys,
            programId: PROGRAM_ID,
            data: v.data
        }));
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = blockhash;

        try {
            const result = await connection.simulateTransaction(tx, [wallet]);
            if (!result.value.err) {
                console.log(`\n✅✅✅ MATCH FOUND! Success!`);
                process.exit(0);
            } else {
                // console.log(JSON.stringify(result.value.err));
            }
        } catch (e) { }
        console.log("Failed.");
    }
}

main();
