
import { getDb } from './mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProposalMapping } from './proposal-scanner';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

async function fetchVestingHistory(connection: Connection, walletStr: string, proposalMap: Map<string, string>) {
    const managerWallet = new PublicKey(walletStr);
    const schedule: any[] = [];
    let totalVestingStake = 0;

    try {
        const grantAccounts = await connection.getProgramAccounts(VESTING_PROGRAM, {
            filters: [{ memcmp: { offset: 8, bytes: managerWallet.toBase58() } }]
        });

        for (const { account } of grantAccounts) {
            // Parse schedule from account data to get total grant
            const data = account.data;
            const START = 104;
            const STRIDE = 80;

            for (let i = START; i <= data.length - STRIDE; i += STRIDE) {
                const amount = Number(data.readBigUInt64LE(i)) / 1e9;
                if (amount === 0) break;

                const tStart = Number(data.readBigUInt64LE(i + 56));

                // Determine proposalId BEFORE adding to totals
                const mappingKey = `${walletStr}:${amount.toFixed(0)}:${tStart}`;
                let proposalId = proposalMap.get(mappingKey);
                if (!proposalId) proposalId = proposalMap.get(`${walletStr}:${amount.toFixed(0)}`);

                // ONLY include tranches linked to a DAO proposal
                if (proposalId) {
                    totalVestingStake += amount; // Sum only filtered tranches

                    const status = (tStart < Date.now() / 1000) ? 'Claimable' : 'Locked';

                    schedule.push({
                        amount,
                        unlockDate: new Date(tStart * 1000),
                        status,
                        isGenesis: tStart === 0,
                        proposalId
                    });
                }
            }
        }
    } catch (e) {
        console.error(`[SyncRewards] Error fetching for ${walletStr}:`, e);
    }
    return { history: schedule, totalVestingStake };
}

export async function syncRewardsForAllManagers() {
    console.log('[SyncRewards] Starting reward sync...');
    const startTime = Date.now();

    try {
        const db = await getDb();
        const connection = new Connection(RPC_URL, 'confirmed');
        const proposalMap = await getProposalMapping();

        const managers = await db.collection('nodes').distinct('managerWallet', { managerWallet: { $ne: null } });
        console.log(`[SyncRewards] Syncing rewards for ${managers.length} managers`);

        for (const wallet of managers) {
            const { history, totalVestingStake } = await fetchVestingHistory(connection, wallet, proposalMap);

            await db.collection('manager_rewards').updateOne(
                { managerWallet: wallet },
                {
                    $set: {
                        managerWallet: wallet,
                        history,
                        totalRewards: totalVestingStake,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            // Also update the nodes collection so the manager list stat is correct
            await db.collection('nodes').updateMany(
                { managerWallet: wallet },
                {
                    $set: {
                        vestingStake: totalVestingStake,
                        updatedAt: new Date()
                    }
                }
            );
        }

        const duration = Date.now() - startTime;
        console.log(`[SyncRewards] ✅ Sync complete for ${managers.length} managers in ${Math.round(duration / 1000)}s`);
        return { success: true, count: managers.length, error: undefined };

    } catch (err) {
        console.error('[SyncRewards] ❌ Sync failed:', err);
        return { success: false, count: 0, error: (err as Error).message };
    }
}

export async function syncRewardsForManager(wallet: string) {
    console.log(`[SyncRewards] Starting targeted sync for ${wallet}...`);
    try {
        const db = await getDb();
        const connection = new Connection(RPC_URL, 'confirmed');
        const proposalMap = await getProposalMapping();

        const { history, totalVestingStake } = await fetchVestingHistory(connection, wallet, proposalMap);

        await db.collection('manager_rewards').updateOne(
            { managerWallet: wallet },
            {
                $set: {
                    managerWallet: wallet,
                    history,
                    totalRewards: totalVestingStake,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // Also update the nodes collection
        await db.collection('nodes').updateMany(
            { managerWallet: wallet },
            {
                $set: {
                    vestingStake: totalVestingStake,
                    updatedAt: new Date()
                }
            }
        );
        console.log(`[SyncRewards] ✅ Target sync complete for ${wallet} (${history.length} DAO tranches)`);
        return { success: true };
    } catch (err) {
        console.error(`[SyncRewards] ❌ Target sync failed for ${wallet}:`, err);
        return { success: false, error: (err as Error).message };
    }
}
