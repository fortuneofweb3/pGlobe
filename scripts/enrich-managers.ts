
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '../lib/server/mongodb-nodes';
import { XANDEUM_NFT_COLLECTIONS } from '../lib/constants/nft';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDAOStake(connection: Connection, ownerPubkey: PublicKey): Promise<number> {
    let retries = 5;
    let delay = 2000; // Start with 2s delay for rate limits

    while (retries > 0) {
        try {
            const accounts = await connection.getProgramAccounts(CUSTOM_GOV_PROGRAM, {
                filters: [
                    { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
                    { memcmp: { offset: 33, bytes: ownerPubkey.toBase58() } }
                ]
            });

            if (accounts.length > 0) {
                let maxStake = 0;
                for (const acc of accounts) {
                    const stake = Number(acc.account.data.readBigUInt64LE(66)) / 1e9;
                    if (stake > maxStake) maxStake = stake;
                }
                return maxStake;
            }
            return 0;
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('429') || msg.includes('limit') || msg.includes('fetch failed')) {
                console.log(`  [fetchDAOStake] Rate limit. Waiting ${delay}ms...`);
                await sleep(delay);
                delay *= 2;
                retries--;
            } else {
                throw err;
            }
        }
    }
    return 0; // Return 0 if we can't fetch after retries
}

async function fetchVestingHistory(connection: Connection, managerWallet: PublicKey) {
    let retries = 5;
    let delay = 2000;

    while (retries > 0) {
        try {
            const result = { totalVested: 0, schedule: [] as any[] };
            const grantAccounts = await connection.getProgramAccounts(VESTING_PROGRAM, {
                filters: [{ memcmp: { offset: 8, bytes: managerWallet.toBase58() } }]
            });

            for (const { pubkey: grantAccount, account } of grantAccounts) {
                const data = account.data;
                const START = 104;
                const STRIDE = 80;

                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(grantAccount, {
                    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                });

                let vaultBalance = 0;
                for (const ta of tokenAccounts.value) {
                    const info = ta.account.data.parsed.info;
                    if (info.mint === 'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx') {
                        vaultBalance += info.tokenAmount.uiAmount || 0;
                    }
                }

                let grantTotal = 0;
                const tranches: any[] = [];
                for (let i = START; i <= data.length - STRIDE; i += STRIDE) {
                    const amount = Number(data.readBigUInt64LE(i)) / 1e9;
                    if (amount === 0) break;
                    const tStart = Number(data.readBigUInt64LE(i + 56));
                    tranches.push({ amount, unlockDate: new Date(tStart * 1000), timestamp: tStart });
                    grantTotal += amount;
                }

                for (const t of tranches) {
                    const status = (t.timestamp < Date.now() / 1000) ? 'Claimable' : 'Locked';

                    result.schedule.push({
                        amount: t.amount,
                        unlockDate: t.unlockDate,
                        status,
                        isGenesis: t.timestamp === 0
                    });
                }
                result.totalVested += vaultBalance; // vestingStake = what's left in vault
            }
            return result;
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('429') || msg.includes('limit') || msg.includes('fetch failed')) {
                console.log(`  [fetchVesting] Rate limit. Waiting ${delay}ms...`);
                await sleep(delay);
                delay *= 2;
                retries--;
            } else {
                throw err;
            }
        }
    }
    return { totalVested: 0, schedule: [] };
}

async function enrichManagers() {
    console.log('Starting Optimized Full Backfill...');
    const connection = new Connection(RPC_URL, 'confirmed');
    const db = await getDb();
    const nodesCollection = db.collection('nodes');
    const rewardsCollection = db.collection('manager_rewards');

    // Get all nodes that have a manager wallet
    const nodes = await nodesCollection.find({ managerWallet: { $exists: true, $ne: null } }).toArray();
    const uniqueManagers = Array.from(new Set(nodes.map((n: any) => n.managerWallet)));
    console.log(`Processing ${uniqueManagers.length} unique managers.`);

    let processedCount = 0;
    for (const managerWallet of uniqueManagers) {
        processedCount++;
        console.log(`[${processedCount}/${uniqueManagers.length}] Manager: ${managerWallet}`);

        try {
            const ownerPubkey = new PublicKey(managerWallet);

            // 1. Fetch Stake & Vesting
            const daoStake = await fetchDAOStake(connection, ownerPubkey);
            const vestingData = await fetchVestingHistory(connection, ownerPubkey);

            // Redefine metrics as per user request:
            // xandStake = daoStake
            // vestingStake = unclaimed rewards (vault balance)
            // claimedStake = already moved to wallet
            const xandStake = daoStake;
            const vestingStake = vestingData.totalVested;

            // 2. Fetch NFT Boost
            let nftBoost = 1;
            try {
                const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
                    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                });
                for (const account of parsedTokenAccounts.value) {
                    const info = account.account.data.parsed.info;
                    if (info.tokenAmount.uiAmount >= 1) {
                        const match = XANDEUM_NFT_COLLECTIONS.find(c => c.collectionId === info.mint);
                        if (match) nftBoost = Math.max(nftBoost, match.multiplier);
                    }
                }
            } catch (e) { }

            // 3. Update Database
            await nodesCollection.updateMany(
                { managerWallet: managerWallet },
                {
                    $set: {
                        xandStake,
                        daoStake,
                        vestingStake,
                        nftBoost,
                        updatedAt: new Date()
                    }
                }
            );

            await rewardsCollection.updateOne(
                { managerWallet: managerWallet },
                {
                    $set: {
                        managerWallet,
                        daoStake,
                        vestingStake,
                        totalStake: daoStake, // Keeping totalStake aligned with xandStake
                        history: vestingData.schedule,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );

            console.log(`  ✅ Updated: DAO=${daoStake.toLocaleString()}, Vesting=${vestingStake.toLocaleString()}`);

        } catch (err: any) {
            console.error(`  ❌ Failed ${managerWallet}:`, err.message);
        }

        // Delay between managers to avoid RPC anger
        await sleep(1500);
    }

    console.log('Backfill Complete.');
    process.exit(0);
}

enrichManagers();
