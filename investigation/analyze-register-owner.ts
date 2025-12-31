/**
 * Investigate the RegisterOwner accounts created on Mainnet
 * These are ~24.7M lamport accounts - might contain node linkages
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// Accounts created by RegisterOwner transactions
const REGISTER_OWNER_ACCOUNTS = [
    '7qeNsGG2QrAzLmB8GRkogU6b9cGu71Cei256LgBQhdNS',
    '2TL9ZxNwKbg5Qu8n5TJDJUBqtxLXRR666TXsF8ZVk6L4'
];

async function investigateRegisterOwnerAccounts() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    // Get devnet nodes
    console.log('Fetching Devnet nodes...\n');
    const indexInfo = await devConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() !== '11111111111111111111111111111111') {
                devnetNodes.add(pk.toBase58());
            }
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes\n`);

    // Analyze RegisterOwner accounts
    for (const accountStr of REGISTER_OWNER_ACCOUNTS) {
        const accountPubkey = new PublicKey(accountStr);
        console.log(`\n=== Analyzing RegisterOwner Account ===`);
        console.log(`Account: ${accountStr}\n`);

        const accountInfo = await mainConn.getAccountInfo(accountPubkey);
        if (!accountInfo) {
            console.log('  Account not found!');
            continue;
        }

        const data = accountInfo.data;
        console.log(`Data size: ${data.length} bytes`);
        console.log(`Owner: ${accountInfo.owner.toBase58()}`);
        console.log(`Lamports: ${accountInfo.lamports}`);

        // Show hex of first 256 bytes
        console.log(`\nFirst 256 bytes (hex):`);
        console.log(data.slice(0, 256).toString('hex'));

        // Try to extract pubkeys at various positions
        console.log(`\nSearching for pubkeys...`);

        // Check common offsets
        const knownOffsets = [0, 8, 32, 40, 64, 72, 96, 104];
        for (const offset of knownOffsets) {
            if (offset + 32 <= data.length) {
                try {
                    const pk = new PublicKey(data.slice(offset, offset + 32));
                    const base58 = pk.toBase58();
                    if (base58 !== '11111111111111111111111111111111') {
                        const isDevnetNode = devnetNodes.has(base58);
                        console.log(`  Offset ${offset}: ${base58} ${isDevnetNode ? '** IS DEVNET NODE **' : ''}`);
                    }
                } catch (e) { }
            }
        }

        // Full scan for devnet nodes
        console.log(`\nFull scan for devnet node pubkeys...`);
        let foundNodes = 0;
        for (let offset = 0; offset + 32 <= data.length; offset++) {
            try {
                const pk = new PublicKey(data.slice(offset, offset + 32));
                if (devnetNodes.has(pk.toBase58())) {
                    console.log(`  ** FOUND NODE at offset ${offset}: ${pk.toBase58()}`);
                    foundNodes++;
                    if (foundNodes >= 10) {
                        console.log(`  ... (stopping after 10 matches)`);
                        break;
                    }
                }
            } catch (e) { }
        }

        if (foundNodes === 0) {
            console.log(`  No devnet nodes found in this account.`);
        }
    }

    // Now check ALL accounts owned by the program with different sizes
    console.log('\n\n=== All Program Account Sizes ===\n');
    const allAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM);

    const sizeMap = new Map<number, number>();
    for (const acc of allAccounts) {
        const size = acc.account.data.length;
        sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    }

    console.log('Account size distribution:');
    for (const [size, count] of [...sizeMap.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`  ${size} bytes: ${count} accounts`);
    }

    // For each non-48 byte size, check one example for devnet nodes
    console.log('\n=== Checking Non-48-byte Accounts for Devnet Nodes ===\n');

    for (const [size, count] of sizeMap.entries()) {
        if (size === 48) continue;

        const example = allAccounts.find(a => a.account.data.length === size);
        if (!example) continue;

        console.log(`Checking ${size}-byte account: ${example.pubkey.toBase58()}`);

        const data = example.account.data;
        let found = false;
        for (let offset = 0; offset + 32 <= data.length; offset++) {
            try {
                const pk = new PublicKey(data.slice(offset, offset + 32));
                if (devnetNodes.has(pk.toBase58())) {
                    console.log(`  ** FOUND NODE at offset ${offset}: ${pk.toBase58()}`);
                    found = true;
                }
            } catch (e) { }
        }

        if (!found) {
            console.log(`  No devnet nodes found.`);
        }
        console.log('');
    }
}

investigateRegisterOwnerAccounts().catch(console.error);
