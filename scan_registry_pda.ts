
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

// Registry PDA for our test node
const REGISTRY_PDA = new PublicKey('DrdLMyKbEC1dvF5fa4mbEfxuxtb4GnS5BQ8cD3MQeWT');

async function scanRegistryForDaoMembers() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log(`Scanning Registry PDA: ${REGISTRY_PDA.toBase58()}`);

    const info = await connection.getAccountInfo(REGISTRY_PDA);
    if (!info) throw new Error('Registry PDA not found');

    const data = info.data;
    console.log(`Data Length: ${data.length}`);

    // Scan every 32-byte chunk for a potential pubkey
    // Skip 8 byte discriminator
    for (let i = 8; i <= data.length - 32; i += 1) { // Scan BYTE BY BYTE to find hidden keys? Or aligned?
        // Let's try aligned to 4 bytes to save requests, or just try distinct 32-byte sequences
        // Actually, let's try every aligned 4 bytes
        if (i % 4 !== 0) continue;

        const potentialKey = new PublicKey(data.slice(i, i + 32));
        const keyStr = potentialKey.toBase58();

        // Filter out obvious non-keys (all 0s or 1s)
        if (keyStr === '11111111111111111111111111111111') continue;

        // Check DAO membership
        const [tokenOwnerRecord] = await PublicKey.findProgramAddress(
            [
                Buffer.from('governance'),
                REALM_ID.toBuffer(),
                XAND_MINT.toBuffer(),
                potentialKey.toBuffer(),
            ],
            GOVERNANCE_PROGRAM_ID
        );

        // Optimization: Batch getAccountInfo? 
        // For now, sequential is fine for a single script run

        const recordInfo = await connection.getAccountInfo(tokenOwnerRecord);
        if (recordInfo) {
            console.log(`✅ FOUND DAO MEMBER at offset ${i}!`);
            console.log(`PubKey: ${keyStr}`);
            console.log(`TokenOwnerRecord: ${tokenOwnerRecord.toBase58()}`);
            return;
        } else {
            // console.log(`Offset ${i}: ${keyStr} - Not a member`);
        }

        if (i % 320 === 0) process.stdout.write('.');
    }
    console.log('\nScan complete. No DAO members found in Registry PDA.');
}

scanRegistryForDaoMembers().catch(console.error);
