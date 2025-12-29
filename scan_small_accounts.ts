
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

async function scanSmallAccountsForDaoMembers() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Fetch all size 34 accounts (likely Manager PDAs?)
    // 34 bytes = 8 discriminator + 26? Or maybe just 32 bytes + ...?
    // Let's try size 34 as seen in previous step
    const accounts = await connection.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 34 }]
    });

    console.log(`Scanning ${accounts.length} accounts of size 34 for DAO members...`);

    let matchCount = 0;
    for (const acc of accounts) {
        // Assume data contains a pubkey. Where?
        // Maybe offset 0? Or offset 1 or 2?
        // Let's try offset 0 (32 bytes)
        if (acc.account.data.length < 32) continue;

        const potentialKey = new PublicKey(acc.account.data.slice(2, 34)); // Try last 32 bytes (offset 2)
        // Or offset 0?
        const potentialKey0 = new PublicKey(acc.account.data.slice(0, 32));

        // Check offset 2
        try {
            const [tor] = PublicKey.findProgramAddressSync(
                [Buffer.from('governance'), REALM_ID.toBuffer(), XAND_MINT.toBuffer(), potentialKey.toBuffer()],
                GOVERNANCE_PROGRAM_ID
            );
            const info = await connection.getAccountInfo(tor);
            if (info) {
                console.log(`✅ FOUND DAO MEMBER in Account ${acc.pubkey.toBase58()} (Offset 2)`);
                console.log(`   Manager Wallet: ${potentialKey.toBase58()}`);
                matchCount++;
                if (matchCount > 3) break; // Just find a few examples
            }
        } catch (e) { }

        // Check offset 0
        try {
            const [tor0] = PublicKey.findProgramAddressSync(
                [Buffer.from('governance'), REALM_ID.toBuffer(), XAND_MINT.toBuffer(), potentialKey0.toBuffer()],
                GOVERNANCE_PROGRAM_ID
            );
            const info0 = await connection.getAccountInfo(tor0);
            if (info0) {
                console.log(`✅ FOUND DAO MEMBER in Account ${acc.pubkey.toBase58()} (Offset 0)`);
                console.log(`   Manager Wallet: ${potentialKey0.toBase58()}`);
                matchCount++;
                if (matchCount > 3) break;
            }
        } catch (e) { }
    }
}

scanSmallAccountsForDaoMembers().catch(console.error);
