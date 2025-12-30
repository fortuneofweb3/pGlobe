
import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const VESTING_ACC = new PublicKey('BR2gRvkVUrJ3gNGgChJNdXcM7cdCQYeYUGNSEkv4Mjxy');
const LARGE_ACC = new PublicKey('ErNipzhgxv6Ci6K1PauVJZ2c1TrznGm1iGe2UKYq6xFd'); // Grant Account
const MANAGER = new PublicKey('3gnisfmyxw8Bch1SHZZ16UDtRG853vv52sPb726jgdbu');
const VAULT_ACC = new PublicKey('FBAKK1mzCBv26HkZ7buVoozVAduxq2uWDghGrVbvDuEK');
const AMOUNT = new BN('30000000000000'); // 30k XAND

async function analyzeRelations() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log('Fetching accounts...');

    const [infoV, infoL] = await connection.getMultipleAccountsInfo([VESTING_ACC, LARGE_ACC]);

    if (!infoV || !infoL) return console.log('Accounts not found');

    const bufL = infoL.data; // Large Account Data

    // Check references
    console.log('\n--- Checking References in Grant Account (ErNi...) ---');

    // Does it contain Manager?
    if (bufL.includes(MANAGER.toBuffer())) {
        console.log(`✅ Manager Key found at offset ${bufL.indexOf(MANAGER.toBuffer())}`);
    } else {
        console.log(`❌ Manager Key NOT found.`);
    }

    // Does it contain Vault?
    if (bufL.includes(VAULT_ACC.toBuffer())) {
        console.log(`✅ Vault Key found at offset ${bufL.indexOf(VAULT_ACC.toBuffer())}`);
    } else {
        console.log(`❌ Vault Key NOT found.`);
    }

    // Search for Amount
    const amtBuf = AMOUNT.toArrayLike(Buffer, 'le', 8);
    console.log(`\nSearching for Amount ${AMOUNT.toString()}...`);

    let foundAmt = false;
    for (let i = 0; i < bufL.length - 8; i++) {
        if (bufL.slice(i, i + 8).equals(amtBuf)) {
            console.log(`✅ Amount found at offset ${i}`);
            foundAmt = true;
        }
    }
}

analyzeRelations();
