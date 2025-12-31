
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDb } from '../lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProposalMapping } from '../lib/server/proposal-scanner';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

async function fetchVestingHistory(connection: Connection, walletStr: string, proposalMap: Map<string, string>) {
    const managerWallet = new PublicKey(walletStr);
    const schedule: any[] = [];

    try {
        const grantAccounts = await connection.getProgramAccounts(VESTING_PROGRAM, {
            filters: [{ memcmp: { offset: 8, bytes: managerWallet.toBase58() } }]
        });

        for (const { account } of grantAccounts) {
            const data = account.data;
            const START = 104;
            const STRIDE = 80;

            for (let i = START; i <= data.length - STRIDE; i += STRIDE) {
                const amount = Number(data.readBigUInt64LE(i)) / 1e9;
                if (amount === 0) break;
                const tStart = Number(data.readBigUInt64LE(i + 56));
                const status = (tStart < Date.now() / 1000) ? 'Claimable' : 'Locked';

                const mappingKey = `${walletStr}:${amount.toFixed(0)}:${tStart}`;
                let proposalId = proposalMap.get(mappingKey);
                if (!proposalId) proposalId = proposalMap.get(`${walletStr}:${amount.toFixed(0)}`);

                schedule.push({
                    amount,
                    unlockDate: new Date(tStart * 1000),
                    status,
                    isGenesis: tStart === 0,
                    proposalId
                });
            }
        }
    } catch (e) {
        console.error(`Error fetching for ${walletStr}:`, e);
    }
    return schedule;
}

async function main() {
    const db = await getDb();
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log('Fetching proposal mapping...');
    const proposalMap = await getProposalMapping();

    console.log('Fetching unique manager wallets...');
    const managers = await db.collection('nodes').distinct('managerWallet', { managerWallet: { $ne: null } });
    console.log(`Found ${managers.length} managers`);

    for (let i = 0; i < managers.length; i++) {
        const wallet = managers[i];
        console.log(`[${i + 1}/${managers.length}] Processing ${wallet}...`);

        const history = await fetchVestingHistory(connection, wallet, proposalMap);

        if (history.length > 0) {
            await db.collection('manager_rewards').updateOne(
                { managerWallet: wallet },
                {
                    $set: {
                        managerWallet: wallet,
                        history,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`  Updated ${history.length} tranches`);
        } else {
            console.log('  No vesting history found');
        }
    }

    console.log('Backfill complete!');
    process.exit(0);
}

main().catch(console.error);
