/**
 * Deep investigation of Mainnet BuyPNode program
 * Goal: Find any data structure that could link to unregistered nodes
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function analyzeMainnetProgram() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Analyzing Mainnet BuyPNode Program ===\n');
    console.log(`Program: ${MAINNET_PROGRAM.toBase58()}\n`);

    // Step 1: Get ALL accounts from the program (not just 48-byte ones)
    console.log('Fetching ALL program accounts...\n');
    const allAccounts = await connection.getProgramAccounts(MAINNET_PROGRAM);

    console.log(`Total accounts: ${allAccounts.length}\n`);

    // Group by data size
    const sizeGroups = new Map<number, typeof allAccounts>();
    for (const acc of allAccounts) {
        const size = acc.account.data.length;
        if (!sizeGroups.has(size)) {
            sizeGroups.set(size, []);
        }
        sizeGroups.get(size)!.push(acc);
    }

    console.log('Account sizes breakdown:');
    for (const [size, accounts] of sizeGroups.entries()) {
        console.log(`  ${size} bytes: ${accounts.length} accounts`);
    }
    console.log('');

    // Step 2: Analyze each size group
    for (const [size, accounts] of sizeGroups.entries()) {
        console.log(`\n=== Analyzing ${size}-byte accounts (${accounts.length} total) ===\n`);

        // Show first 3 examples
        const examples = accounts.slice(0, 3);
        for (let i = 0; i < examples.length; i++) {
            const acc = examples[i];
            console.log(`Example ${i + 1}: ${acc.pubkey.toBase58()}`);
            console.log(`  Raw hex: ${acc.account.data.toString('hex')}`);

            // Try to extract pubkeys at various offsets
            const data = acc.account.data;
            console.log('  Potential pubkeys:');

            for (let offset = 0; offset + 32 <= data.length; offset += 8) {
                try {
                    const potentialPubkey = new PublicKey(data.slice(offset, offset + 32));
                    const base58 = potentialPubkey.toBase58();
                    // Skip all-zeros and system program
                    if (base58 !== '11111111111111111111111111111111') {
                        console.log(`    Offset ${offset}: ${base58}`);
                    }
                } catch (e) { }
            }
            console.log('');
        }
    }

    // Step 3: Check recent transactions of the program
    console.log('\n=== Recent Program Transactions ===\n');
    const sigs = await connection.getSignaturesForAddress(MAINNET_PROGRAM, { limit: 5 });

    for (const sig of sigs) {
        console.log(`\nTransaction: ${sig.signature}`);
        const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) continue;

        console.log('  Accounts involved:');
        for (let i = 0; i < tx.transaction.message.accountKeys.length; i++) {
            const acc = tx.transaction.message.accountKeys[i];
            console.log(`    [${i}] ${acc.pubkey.toBase58()} ${acc.signer ? '(signer)' : ''} ${acc.writable ? '(writable)' : ''}`);
        }

        // Check inner instructions
        if (tx.meta?.innerInstructions?.length) {
            console.log('  Has inner instructions');
        }

        // Check logs
        if (tx.meta?.logMessages) {
            console.log('  Logs:');
            for (const log of tx.meta.logMessages.slice(0, 10)) {
                console.log(`    ${log}`);
            }
        }
    }
}

analyzeMainnetProgram().catch(console.error);
