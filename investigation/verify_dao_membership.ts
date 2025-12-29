
import { Connection, PublicKey } from '@solana/web3.js';
import { getRealm, getTokenOwnerRecord, getGovernanceAccounts } from '@solana/spl-governance';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

// Wallet derived from previous step
const MANAGER_WALLET = new PublicKey('6iABQ7kVxG1KMaj4sCwWjabEbADDSShsnZmrWKhywc63');

async function checkDaoMembership() {
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log(`Checking DAO membership for: ${MANAGER_WALLET.toBase58()}`);
    console.log(`Realm: ${REALM_ID.toBase58()}`);

    try {
        // 1. Derive TokenOwnerRecord address
        const [tokenOwnerRecordAddress] = await PublicKey.findProgramAddress(
            [
                Buffer.from('governance'),
                REALM_ID.toBuffer(),
                XAND_MINT.toBuffer(),
                MANAGER_WALLET.toBuffer(),
            ],
            GOVERNANCE_PROGRAM_ID
        );
        console.log(`Expected TokenOwnerRecord Address: ${tokenOwnerRecordAddress.toBase58()}`);

        // 2. Fetch the record
        const info = await connection.getAccountInfo(tokenOwnerRecordAddress);

        if (info) {
            console.log('✅ TokenOwnerRecord FOUND! This wallet IS a member of the DAO.');
            // We could parse it with `getTokenOwnerRecord` but existence is enough for "is member" check
            // assuming they have > 0 deposit
            console.log(`Data Length: ${info.data.length} bytes`);
        } else {
            console.log('❌ TokenOwnerRecord NOT found. This wallet is NOT a member of the DAO (or has no deposited stake).');
        }
    } catch (e) {
        console.error('Error checking DAO membership:', e);
    }
}

checkDaoMembership().catch(console.error);
