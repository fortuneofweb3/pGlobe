
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

async function inspectCustomStake() {
    const connection = new Connection(RPC_URL, 'confirmed');
    // The working manager
    const managerStr = 'Bx1aHrYYhrqKAHkJZE7qrbEBHX43LBKgsy3aBwu2h1Zr';
    const manager = new PublicKey(managerStr);

    console.log(`Inspecting Custom Stake for WORKING Manager: ${managerStr}`);

    try {
        const accounts = await connection.getProgramAccounts(CUSTOM_GOV_PROGRAM, {
            filters: [
                { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
                { memcmp: { offset: 33, bytes: manager.toBase58() } }
            ]
        });

        console.log(`Found ${accounts.length} accounts.`);

        if (accounts.length > 0) {
            const acc = accounts[0];
            const data = acc.account.data;
            console.log(`Data Length: ${data.length}`);

            // Dump Hex
            const hex = data.slice(0, 100).toString('hex');
            for (let i = 0; i < hex.length; i += 32) {
                console.log(`Offset ${i / 2}: ${hex.slice(i, i + 32)}`);
            }

            // Verify Offsets
            // Offset 33: Owner?
            const ownerInAcc = new PublicKey(data.slice(33, 65));
            console.log(`Offset 33 (Owner?): ${ownerInAcc.toBase58()}`);

            // Offset 66: Stake?
            const stake = Number(data.readBigUInt64LE(66));
            console.log(`Offset 66 (Stake?): ${stake} (${stake / 1e9} XAND)`);
        }

    } catch (err) {
        console.error('Error:', err);
    }

    process.exit(0);
}

inspectCustomStake();
