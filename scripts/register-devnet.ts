
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Constants from xandminerd/src/transactions.js
const DEVNET_PROGRAM = new PublicKey("6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL");
const INDEX_ACCOUNT = new PublicKey("GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs");
const WALLET_FILE = 'devnet-wallet.json';

// Xandeum Devnet RPC (Primary) -> Fallback to Solana Devnet if needed
const RPCS = [
    "https://api.devnet.xandeum.com:8899",
    "https://api.devnet.solana.com"
];

function numToUint8Array(num: number) {
    const buffer = Buffer.alloc(8); // 8 bytes for u64
    // Write as little-endian 64-bit unsigned integer
    buffer.writeBigUInt64LE(BigInt(num));
    return buffer;
}

async function main() {
    console.log(`\n🔵 INITIALIZING XANDEUM DEVNET REGISTRATION...`);

    // 1. Setup Connection
    let connection: Connection | null = null;
    for (const rpc of RPCS) {
        console.log(`Trying RPC: ${rpc}...`);
        try {
            const conn = new Connection(rpc, 'confirmed');
            const v = await conn.getVersion();
            console.log(`  ✅ Connected! Version: ${v['solana-core']}`);
            connection = conn;
            break;
        } catch (e) {
            console.log(`  ❌ Failed: ${e.message}`);
        }
    }

    if (!connection) {
        console.error("❌ Could not connect to any Devnet RPC. Aborting.");
        return;
    }

    // 2. Load/Create Wallet
    let wallet: Keypair;
    const walletPath = path.resolve(process.cwd(), WALLET_FILE);
    if (fs.existsSync(walletPath)) {
        const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(secret));
        console.log(`✅ Loaded wallet: ${wallet.publicKey.toBase58()}`);
    } else {
        wallet = Keypair.generate();
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(wallet.secretKey)));
        console.log(`🆕 Created wallet: ${wallet.publicKey.toBase58()}`);
    }

    // 3. Fund Wallet (Airdrop)
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 1 * LAMPORTS_PER_SOL) {
        console.log(`Requesting Airdrop...`);
        try {
            const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig);
            console.log(`  ✅ Airdrop received.`);
        } catch (e) {
            console.log(`  ⚠️ Airdrop failed (Faucet might be dry): ${e.message}`);
            if (balance === 0) {
                console.log("  ❌ Cannot proceed with 0 balance. Please fund manually.");
                return;
            }
        }
    }

    // 4. Derive PDAs (Exact logic from transactions.js)
    const registry = PublicKey.findProgramAddressSync(
        [Buffer.from("registry"), wallet.publicKey.toBuffer()],
        DEVNET_PROGRAM
    )[0];

    const global = PublicKey.findProgramAddressSync(
        [Buffer.from("global")],
        DEVNET_PROGRAM
    )[0];

    // Note: transactions.js uses `owner` variable which defaults to walletPubKey if not passed.
    // In our case, wallet is the owner.
    const manager = PublicKey.findProgramAddressSync(
        [Buffer.from("manager"), wallet.publicKey.toBuffer()],
        DEVNET_PROGRAM
    )[0];

    console.log(`Registry PDA: ${registry.toBase58()}`);
    console.log(`Global PDA: ${global.toBase58()}`);
    console.log(`Manager PDA: ${manager.toBase58()}`);

    // 5. Get Index for Data
    // Logic: Read Index Account, find empty slot (null/default pubkey), calculate offset
    console.log(`Scanning Index Account (${INDEX_ACCOUNT.toBase58()})...`);
    const indexInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (!indexInfo) {
        console.error("❌ Index Account not found! Program might only exist on Xandeum sidechain.");
        return;
    }

    let targetIndex = -1;
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const slice = indexInfo.data.slice(i, i + 32);
        // check if all zeros (default public key)
        if (slice.every(b => b === 0)) {
            targetIndex = i / 32; // Index is element count, not byte offset?
            // transactions.js: 
            // for (let j = 0; j < pnodes.length; j++) ... if (pnodes[j] == Default) index = j
            // const data = Buffer.concat([Buffer.from(Int8Array.from([0]).buffer), numToUint8Array(index)]);
            break;
        }
    }

    if (targetIndex === -1) {
        // Append to end if no empty slots? transactions.js implies there's always a slot or it grows?
        // Actually transactions.js crashes/errors if no slot found? 
        // Let's assume we append to the end.
        targetIndex = indexInfo.data.length / 32;
        console.log(`⚠️ No empty slots found. Appending at index ${targetIndex}.`);
    } else {
        console.log(`✅ Found empty slot at Index ${targetIndex}`);
    }

    // 6. Construct Transaction
    // Instruction Data: [0] (Enum for Register?) + [Index as u64]
    const data = Buffer.concat([Buffer.from([0]), numToUint8Array(targetIndex)]);

    const keys = [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: registry, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // Owner
        { pubkey: global, isSigner: false, isWritable: true },
        { pubkey: manager, isSigner: false, isWritable: true },
        { pubkey: INDEX_ACCOUNT, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    // NOTE: transactions.js includes explicit SysvarRent and SystemProgram with hardcoded IDs
    // that seem standard. We use web3.js constants.

    // transactions.js keys order: 
    // Wallet, Registry, Owner, Global, Manager, Index, System, Rent

    const instruction = new TransactionInstruction({
        keys,
        programId: DEVNET_PROGRAM,
        data
    });

    const transaction = new Transaction().add(instruction);

    console.log(`🚀 Sending Registration Transaction...`);
    try {
        const sig = await connection.sendTransaction(transaction, [wallet]);
        console.log(`Signature: ${sig}`);
        console.log(`Waiting for confirmation...`);
        await connection.confirmTransaction(sig);
        console.log(`\n✅✅✅ DEVNET REGISTRATION SUCCESSFUL! ✅✅✅`);
        console.log(`Your Node Address: ${registry.toBase58()}`);
    } catch (e: any) {
        console.error(`❌ Transaction Failed: ${e.message}`);
        if (e.logs) {
            console.log("Logs:");
            e.logs.forEach((l: string) => console.log(`  ${l}`));
        }
    }
}

import { SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
main();
