
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');
const REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

async function checkRealmsStake() {
    console.log('Checking Standard Realms Stake...');
    const connection = new Connection(RPC_URL, 'confirmed');

    // Sample managers who showed 0 stake
    const managers = [
        'D7Tm6P4XoXn9d4Ye63JbhyzZrdeR3Pr2aivbweH7G9u2',
        'GfqAkS8ZkxLZ9TFUYM6pTJstneYcsZmdTmJmEZvj91oY',
        'CYJpE1GmMN9oEKHBRWYC5DSKYkYNK2VJBbogXi5MLFu6'
    ];

    for (const managerStr of managers) {
        try {
            const manager = new PublicKey(managerStr);

            // Derive TokenOwnerRecord address
            const [tokenOwnerRecordAddress] = await PublicKey.findProgramAddress(
                [
                    Buffer.from('governance'),
                    REALM_ID.toBuffer(),
                    XAND_MINT.toBuffer(),
                    manager.toBuffer(),
                ],
                GOVERNANCE_PROGRAM_ID
            );

            console.log(`Checking ${managerStr} -> TOR: ${tokenOwnerRecordAddress.toBase58()}`);

            const info = await connection.getAccountInfo(tokenOwnerRecordAddress);
            if (info) {
                // TokenOwnerRecord Layout:
                // 0: accountType (1 byte)
                // 1: realm (32 bytes)
                // 33: governingTokenMint (32 bytes)
                // 65: governingTokenOwner (32 bytes)
                // 97: governingTokenDepositAmount (u64)
                // ...

                const depositAmount = Number(info.data.readBigUInt64LE(97)) / 1e9;
                console.log(`✅ FOUND! Deposit Amount: ${depositAmount.toLocaleString()} XAND`);
            } else {
                console.log(`❌ No TokenOwnerRecord found.`);
            }

        } catch (err) {
            console.error(`Error checking ${managerStr}:`, err);
        }
    }

    process.exit(0);
}

checkRealmsStake();
