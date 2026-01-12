
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = 'https://mainnet.helius-rpc.com/?api-key=' + HELIUS_API_KEY;
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

async function checkAddress(address: string) {
    const conn = new Connection(MAINNET_RPC);
    const pubkey = new PublicKey(address);

    console.log('Checking address:', address);
    console.log('---');

    // 1. SOL Balance
    const balance = await conn.getBalance(pubkey);
    console.log('SOL Balance:', balance / 1e9, 'SOL');

    // 2. DAO Stake
    try {
        const stakeAccounts = await conn.getProgramAccounts(CUSTOM_GOV_PROGRAM, {
            filters: [
                { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
                { memcmp: { offset: 33, bytes: pubkey.toBase58() } }
            ]
        });

        if (stakeAccounts.length > 0) {
            console.log('Found', stakeAccounts.length, 'DAO Stake accounts');
            for (const { pubkey: acctPk, account } of stakeAccounts) {
                const stake = Number(account.data.readBigUInt64LE(66)) / 1e9;
                console.log(`- Account: ${acctPk.toBase58()}, Amount: ${stake} XAND`);
            }
        } else {
            console.log('No DAO stake accounts found');
        }
    } catch (e) {
        console.log('DAO stake check error:', e.message);
    }

    // 3. Vesting
    try {
        const grantAccounts = await conn.getProgramAccounts(VESTING_PROGRAM, {
            filters: [{ memcmp: { offset: 8, bytes: pubkey.toBase58() } }]
        });

        if (grantAccounts.length > 0) {
            console.log('Found', grantAccounts.length, 'Vesting accounts');
            for (const { pubkey: acctPk, account } of grantAccounts) {
                const data = account.data;
                const START = 104;
                const STRIDE = 80;
                let totalGrant = 0;

                for (let i = START; i <= data.length - STRIDE; i += STRIDE) {
                    const amount = Number(data.readBigUInt64LE(i)) / 1e9;
                    if (amount === 0) break;
                    totalGrant += amount;
                }
                console.log(`- Account: ${acctPk.toBase58()}, Total Grant: ${totalGrant} XAND`);
            }
        } else {
            console.log('No vesting accounts found');
        }
    } catch (e) {
        console.log('Vesting check error:', e.message);
    }
}

checkAddress('CYxrrpDtELXmP5u5CBSA2KWaWzov2VmF5aRFJdGRLuVy');
