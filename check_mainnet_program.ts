
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM_ID = new PublicKey('3hMZVwdgRHYSyqkdK3Y8MdZzNwLkjzXod1XrKcniXw56');
const TARGET_OWNER = '5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W';

async function scanMainnet() {
    console.log(`Scanning Mainnet Program ${MAINNET_PROGRAM_ID.toBase58()}...`);
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    // 1. Check if Program Exists
    const progInfo = await connection.getAccountInfo(MAINNET_PROGRAM_ID);
    if (!progInfo) {
        console.log('❌ Program ID not found on Mainnet.');
        return;
    }
    console.log('✅ Program ID found and matches.');
    console.log(`   Executable: ${progInfo.executable}`);

    // 2. Fetch All Accounts owned by Program (Registry/Manager PDAs)
    console.log('Fetching all program accounts (this might take a while)...');
    const accounts = await connection.getProgramAccounts(MAINNET_PROGRAM_ID, {
        filters: [
            { dataSize: 1040 } // Assuming Registry size is consistent
        ]
    });
    console.log(`Found ${accounts.length} potential Registry accounts (size 1040).`);

    // 3. Scan for Owner
    console.log(`Scanning for Owner ${TARGET_OWNER}...`);
    let found = false;
    for (const acc of accounts) {
        const owner = new PublicKey(acc.account.data.slice(8, 40));
        if (owner.toBase58() === TARGET_OWNER) {
            console.log(`🎉 MATCH FOUND!`);
            console.log(`   Registry PDA: ${acc.pubkey.toBase58()}`);
            console.log(`   Owner (Offset 8): ${owner.toBase58()}`);

            // Can we find the Node Pubkey?
            // Registry is usually seeded by ['registry', node_pubkey].
            // We can't reverse-derive the seed easily from just the PDA.
            // BUT, usually the Node Pubkey is stored inside the Registry too?
            // Inspect the data structure more closely if we find it.

            found = true;
        }
    }

    if (!found) {
        console.log('❌ Owner not found in any Mainnet Registry.');

        // Try scanning Manager accounts (Size 34?)
        console.log('Scanning potential Manager accounts (Size 34)...');
        const managers = await connection.getProgramAccounts(MAINNET_PROGRAM_ID, {
            filters: [{ dataSize: 34 }]
        });
        console.log(`Found ${managers.length} potential Manager accounts.`);

        for (const acc of managers) {
            const owner = new PublicKey(acc.account.data.slice(0, 32));
            if (owner.toBase58() === TARGET_OWNER) {
                console.log(`🎉 MATCH FOUND in MANAGER Account!`);
                console.log(`   Manager PDA: ${acc.pubkey.toBase58()}`);
                console.log(`   Owner (Offset 0): ${owner.toBase58()}`);
                found = true;
            }
        }
    }
}

scanMainnet().catch(console.error);
