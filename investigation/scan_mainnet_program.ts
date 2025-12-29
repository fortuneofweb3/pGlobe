
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const TARGET_WALLET = '5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W';

async function scanProgram() {
    console.log(`Scanning Mainnet Program ${MAINNET_PROGRAM.toBase58()}...`);
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // Check if program exists
    const progInfo = await connection.getAccountInfo(MAINNET_PROGRAM);
    if (!progInfo) {
        console.log('Program not found!');
        return;
    }
    console.log(`✅ Program found! Executable: ${progInfo.executable}`);

    // Get all program accounts
    console.log('Fetching all program accounts (may take a while)...');
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM);
    console.log(`Found ${accounts.length} accounts.`);

    // Group by size
    const sizeGroups = new Map<number, number>();
    for (const acc of accounts) {
        const size = acc.account.data.length;
        sizeGroups.set(size, (sizeGroups.get(size) || 0) + 1);
    }
    console.log('\nAccount Size Distribution:');
    for (const [size, count] of [...sizeGroups.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`   Size ${size}: ${count} accounts`);
    }

    // Search for target wallet in accounts
    console.log(`\nSearching for target wallet ${TARGET_WALLET}...`);
    let found = false;

    for (const acc of accounts) {
        const data = acc.account.data;

        // Check various offsets for PublicKey (32 bytes)
        const offsets = [0, 8, 32, 40, 64]; // Common positions
        for (const offset of offsets) {
            if (data.length >= offset + 32) {
                const key = new PublicKey(data.slice(offset, offset + 32));
                if (key.toBase58() === TARGET_WALLET) {
                    console.log(`🎉 MATCH FOUND!`);
                    console.log(`   PDA: ${acc.pubkey.toBase58()}`);
                    console.log(`   Size: ${data.length}`);
                    console.log(`   Offset: ${offset}`);
                    console.log(`   Data (Hex first 128): ${data.slice(0, 128).toString('hex')}`);
                    found = true;
                }
            }
        }
    }

    if (!found) {
        console.log('Target wallet NOT directly embedded in any account.');
        console.log('Inspecting first 3 accounts of each size...');

        const inspected = new Map<number, number>();
        for (const acc of accounts) {
            const size = acc.account.data.length;
            if ((inspected.get(size) || 0) < 3) {
                inspected.set(size, (inspected.get(size) || 0) + 1);
                console.log(`\n[Size ${size}] ${acc.pubkey.toBase58()}`);
                console.log(`   Data: ${acc.account.data.slice(0, Math.min(64, size)).toString('hex')}`);

                // Try to decode potential pubkeys
                if (size >= 32) {
                    console.log(`   Key@0: ${new PublicKey(acc.account.data.slice(0, 32)).toBase58()}`);
                }
                if (size >= 40) {
                    console.log(`   Key@8: ${new PublicKey(acc.account.data.slice(8, 40)).toBase58()}`);
                }
            }
        }
    }
}

scanProgram().catch(console.error);
