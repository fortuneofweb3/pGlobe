
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const CUSTOM_GOV_PROGRAM = new PublicKey('6BzzbCDvT3PjngLwbGk5J8Sjji8kH19kUa2c1sJmwP14');
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

// Known Test Wallets
const DAO_MANAGER = new PublicKey('Bx1aHrYYhrqKAHkJZE7qrbEBHX43LBKgsy3aBwu2h1Zr');
const VESTING_MANAGER = new PublicKey('3gnisfmyxw8Bch1SHZZ16UDtRG853vv52sPb726jgdbu');

async function getProgramAccountsWithRetry(connection: Connection, programId: PublicKey, config: any) {
    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
        try {
            return await connection.getProgramAccounts(programId, config);
        } catch (e: any) {
            if (e.message && (e.message.includes('429') || e.message.includes('limit'))) {
                console.log(`Rate limited. Waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
                retries--;
            } else {
                throw e;
            }
        }
    }
    throw new Error('Max retries exceeded');
}

async function inspectLockups() {
    console.log('Inspecting Lockup Data...');
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Inspect DAO Stake Account
    console.log(`\n--- DAO Stake (Manager: ${DAO_MANAGER.toBase58()}) ---`);
    try {
        const daoAccounts: any = await getProgramAccountsWithRetry(connection, CUSTOM_GOV_PROGRAM, {
            filters: [
                { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
                { memcmp: { offset: 33, bytes: DAO_MANAGER.toBase58() } }
            ]
        });

        if (daoAccounts.length > 0) {
            const acc = daoAccounts[0];
            console.log(`Found Account: ${acc.pubkey.toBase58()}`);
            console.log(`Data Len: ${acc.account.data.length}`);
            console.log(`Hex Dump:`);
            console.log(acc.account.data.toString('hex'));
        } else {
            console.log('No DAO Stake account found.');
        }
    } catch (e) { console.error('DAO Fetch Error:', e); }

    // 2. Inspect Vesting Account
    console.log(`\n--- Vesting Account (Manager: ${VESTING_MANAGER.toBase58()}) ---`);
    try {
        const vestingAccounts: any = await getProgramAccountsWithRetry(connection, VESTING_PROGRAM, {
            filters: [
                { dataSize: 176 },
                { memcmp: { offset: 72, bytes: VESTING_MANAGER.toBase58() } }
            ]
        });

        if (vestingAccounts.length > 0) {
            const acc = vestingAccounts[0];
            console.log(`Found Account: ${acc.pubkey.toBase58()}`);
            console.log(`Data Len: ${acc.account.data.length}`);
            console.log(`Hex Dump:`);
            console.log(acc.account.data.toString('hex'));
        } else {
            console.log('No Vesting account found.');
        }
    } catch (e) { console.error('Vesting Fetch Error:', e); }
}

inspectLockups();
