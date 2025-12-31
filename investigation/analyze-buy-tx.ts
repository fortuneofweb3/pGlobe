/**
 * Analyze Mainnet BUY transactions to see if node pubkey is in the instruction data
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const TARGET_NODE = 'BTy8gWMBozRFhoNuTfiSL8yqDe6VhUJ5F52A79D74snY';

async function analyzeBuyTransactions() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Analyzing Mainnet Buy Transactions ===\n');

    // Get program transaction history (going back further)
    const sigs = await connection.getSignaturesForAddress(MAINNET_PROGRAM, { limit: 100 });
    console.log(`Found ${sigs.length} program transactions\n`);

    // Find actual "buy" transactions (not RegisterOwner or other types)
    let buyTxCount = 0;

    for (const sig of sigs) {
        const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) continue;

        const logs = tx.meta?.logMessages || [];

        // Look for buy-related instructions
        const isBuy = logs.some(l =>
            l.includes('BuyPnode') ||
            l.includes('Buy') ||
            l.includes('Purchase') ||
            l.includes('buy_pnode')
        );

        const isRegisterOwner = logs.some(l => l.includes('RegisterOwner'));
        const isTransferFunds = logs.some(l => l.includes('TransferFunds'));

        // Skip non-buy transactions
        if (isRegisterOwner || isTransferFunds) continue;

        buyTxCount++;

        if (buyTxCount <= 5) {
            console.log(`\n=== Transaction ${buyTxCount} ===`);
            console.log(`TX: ${sig.signature}`);
            console.log(`Time: ${sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'N/A'}`);

            // Show all accounts
            console.log('\nAccounts:');
            const accountKeys = tx.transaction.message.accountKeys;
            for (let i = 0; i < accountKeys.length; i++) {
                const acc = accountKeys[i];
                let role = '';
                if (acc.signer) role += '[SIGNER] ';
                if (acc.writable) role += '[WRITABLE] ';
                console.log(`  [${i}] ${acc.pubkey.toBase58()} ${role}`);
            }

            // Show instruction data
            console.log('\nInstructions:');
            for (const instr of tx.transaction.message.instructions) {
                if ('data' in instr && 'programId' in instr) {
                    const progId = instr.programId.toBase58();
                    if (progId === MAINNET_PROGRAM.toBase58()) {
                        const data = (instr as any).data;
                        if (data) {
                            console.log(`  Program: ${progId}`);
                            console.log(`  Data (base58): ${data}`);

                            // Decode and show raw bytes
                            try {
                                const decoded = bs58.decode(data);
                                console.log(`  Data (hex): ${Buffer.from(decoded).toString('hex')}`);
                                console.log(`  Data length: ${decoded.length} bytes`);

                                // If data is 40+ bytes, might contain a pubkey
                                if (decoded.length >= 40) {
                                    console.log(`  Possible pubkey in data (bytes 8-40):`);
                                    const possiblePk = new PublicKey(decoded.slice(8, 40));
                                    console.log(`    ${possiblePk.toBase58()}`);

                                    if (possiblePk.toBase58() === TARGET_NODE) {
                                        console.log(`    ** THIS IS THE TARGET NODE! **`);
                                    }
                                }
                            } catch (e) {
                                console.log(`  Could not decode: ${e}`);
                            }
                        }
                    }
                }
            }

            // Show relevant logs
            console.log('\nLogs:');
            for (const log of logs.slice(0, 15)) {
                console.log(`  ${log}`);
            }
        }
    }

    console.log(`\n\nTotal buy-type transactions found: ${buyTxCount}`);

    // Now let's search ALL program transactions for our target node pubkey
    console.log('\n\n=== Searching ALL transactions for target node pubkey ===\n');
    console.log(`Target: ${TARGET_NODE}\n`);

    const targetBytes = new PublicKey(TARGET_NODE).toBuffer();
    let foundCount = 0;

    for (const sig of sigs) {
        const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) continue;

        // Check account keys
        const hasTargetInAccounts = tx.transaction.message.accountKeys.some(
            a => a.pubkey.toBase58() === TARGET_NODE
        );

        if (hasTargetInAccounts) {
            foundCount++;
            console.log(`** FOUND in accounts: ${sig.signature}`);
        }

        // Check instruction data
        for (const instr of tx.transaction.message.instructions) {
            if ('data' in instr && (instr as any).data) {
                try {
                    const decoded = bs58.decode((instr as any).data);
                    // Search for target bytes
                    for (let i = 0; i <= decoded.length - 32; i++) {
                        if (Buffer.from(decoded.slice(i, i + 32)).equals(targetBytes)) {
                            foundCount++;
                            console.log(`** FOUND in instruction data: ${sig.signature} at offset ${i}`);
                        }
                    }
                } catch (e) { }
            }
        }
    }

    console.log(`\nTotal occurrences of target node in transactions: ${foundCount}`);
}

analyzeBuyTransactions().catch(console.error);
