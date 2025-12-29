
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const TARGET_WALLET = '5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W';

async function scan() {
    console.log(`Checking Program ${PROGRAM_ID.toBase58()} on Mainnet...`);
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    const account = await connection.getAccountInfo(PROGRAM_ID);
    if (!account) {
        console.log('❌ Program NOT found on Mainnet.');
        return;
    }
    console.log('✅ Program FOUND on Mainnet!');
    console.log(`   Executable: ${account.executable}`);
    console.log(`   Data Size: ${account.data.length}`);

    // Scan all accounts
    console.log('Fetching all program accounts...');
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`Found ${accounts.length} accounts.`);

    let found = false;
    // Inspect for Owner (Offset 8 or Offset 0)
    for (const acc of accounts) {
        const data = acc.account.data;
        // Check Offset 8 (Registry style)
        if (data.length >= 40) {
            const owner = new PublicKey(data.slice(8, 40));
            if (owner.toBase58() === TARGET_WALLET) {
                console.log(`🎉 MATCH at Offset 8!`);
                console.log(`   PDA: ${acc.pubkey.toBase58()}`);
                console.log(`   Size: ${data.length}`);
                found = true;
            }
        }
        // Check Offset 0 (Manager style)
        if (data.length >= 32) {
            const owner = new PublicKey(data.slice(0, 32));
            if (owner.toBase58() === TARGET_WALLET) {
                console.log(`🎉 MATCH at Offset 0!`);
                console.log(`   PDA: ${acc.pubkey.toBase58()}`);
                console.log(`   Size: ${data.length}`);
                found = true;
            }
        }
    }

    if (!found) console.log('❌ Target wallet NOT found in any program account.');
}

scan().catch(console.error);
