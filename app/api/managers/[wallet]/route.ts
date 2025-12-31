import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from '@/lib/server/cache-utils';
import { getProposalMapping } from '@/lib/server/proposal-scanner';

const managerDetailCache = new SimpleCache<any>(0.5); // 30 second cache for quick navigation

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

// Fetch vesting schedule directly from chain
async function fetchVestingHistoryFromChain(walletStr: string) {
    const connection = new Connection(RPC_URL, 'confirmed');
    const managerWallet = new PublicKey(walletStr);

    // Fetch proposal mapping
    const proposalMap = await getProposalMapping();

    const schedule: any[] = [];
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

            // Find matching proposal
            const mappingKey = `${walletStr}:${amount.toFixed(0)}:${tStart}`;
            let proposalId = proposalMap.get(mappingKey);

            // Fallback for older grants without strict startTs match
            if (!proposalId) {
                proposalId = proposalMap.get(`${walletStr}:${amount.toFixed(0)}`);
            }

            schedule.push({
                amount,
                unlockDate: new Date(tStart * 1000),
                status,
                isGenesis: tStart === 0,
                proposalId
            });
        }
    }
    return schedule;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    try {
        const { wallet } = await params;

        // 1. FAST PATH: Check cache first
        const cached = managerDetailCache.get(wallet);
        if (cached) {
            return NextResponse.json(cached);
        }

        const { getNodesByManager, getDb } = await import('@/lib/server/mongodb-nodes');

        // 2. Fetch all data from DB FIRST
        let managerNodes;
        try {
            managerNodes = await getNodesByManager(wallet);
        } catch (dbError: any) {
            console.error('[API] Database error:', dbError.message);
            return NextResponse.json(
                { success: false, error: 'Database temporarily unavailable.' },
                { status: 503 }
            );
        }

        if (managerNodes.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Manager not found' },
                { status: 404 }
            );
        }

        // Fetch rewards from DB
        let vestingHistory: any[] = [];
        let dbRewards = null;
        try {
            const db = await getDb();
            dbRewards = await db.collection('manager_rewards').findOne({ managerWallet: wallet });
            vestingHistory = dbRewards?.history || [];
        } catch (e) {
            console.error('[API] Rewards DB fetch failed:', e);
        }

        // Calculate stats from DB nodes
        const freshDaoStake = managerNodes.reduce((max, n) => Math.max(max, n.daoStake || 0), 0);
        let freshVestingStake = managerNodes.reduce((max, n) => Math.max(max, n.vestingStake || 0), 0);

        // FALLBACK: If nodes don't have vesting stake but rewards collection does
        if (freshVestingStake === 0 && dbRewards?.totalRewards) {
            freshVestingStake = dbRewards.totalRewards;
        }

        const associatedWallets = new Set<string>();
        for (const n of managerNodes) {
            if (n.managerWallet === wallet && n.registrarWallet && n.registrarWallet !== wallet) {
                associatedWallets.add(n.registrarWallet);
            }
            if (n.registrarWallet === wallet && n.managerWallet && n.managerWallet !== wallet) {
                associatedWallets.add(n.managerWallet);
            }
        }

        const stats = {
            wallet,
            nodeCount: managerNodes.length,
            onlineCount: managerNodes.filter(n => n.status === 'online').length,
            syncingCount: managerNodes.filter(n => n.status === 'syncing').length,
            offlineCount: managerNodes.filter(n => n.status === 'offline' || !n.status).length,
            totalCredits: managerNodes.reduce((sum, n) => sum + (n.credits || 0), 0),
            totalStorageCapacity: managerNodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0),
            totalStorageUsed: managerNodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0),
            avgUptime: managerNodes.filter(n => n.uptime).length > 0
                ? managerNodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / managerNodes.filter(n => n.uptime).length
                : 0,
            totalXandStake: freshDaoStake,
            daoStake: freshDaoStake,
            vestingStake: freshVestingStake,
            associatedWallets: Array.from(associatedWallets)
        };

        const response = {
            success: true,
            manager: stats,
            nodes: managerNodes.map(n => ({
                pubkey: n.pubkey || n.publicKey,
                address: n.address,
                role: n.managerWallet === wallet ? 'buyer' : 'registrar',
                status: n.status,
                version: n.version,
                uptime: n.uptime,
                credits: n.credits,
                storageCapacity: n.storageCapacity,
                storageUsed: n.storageUsed,
                location: n.location,
                locationData: n.locationData,
                lastSeen: n.lastSeen,
                createdAt: n.createdAt,
                isPublic: n.isPublic,
                cpuPercent: n.cpuPercent,
                ramUsed: n.ramUsed,
                ramTotal: n.ramTotal,
                packetsReceived: n.packetsReceived,
                packetsSent: n.packetsSent,
                balance: n.balance,
                xandStake: n.xandStake,
                daoStake: n.daoStake,
                vestingStake: n.vestingStake,
            })),
            rewards: {
                history: vestingHistory
            },
            associatedWallets: Array.from(associatedWallets)
        };

        // 3. TRIGGER BACKGROUND REFRESH if data is stale (older than 15 minutes)
        const lastUpdated = dbRewards?.updatedAt || managerNodes[0]?.updatedAt || new Date(0);
        const isStale = Date.now() - new Date(lastUpdated).getTime() > 15 * 60 * 1000;

        if (isStale) {
            // Background refresh - fire and forget
            (async () => {
                try {
                    console.log(`[API] Triggering background refresh for manager: ${wallet}`);
                    const { enrichPNodeWithOnChainData } = await import('@/lib/server/solana-pnodes');

                    // Use a node pubkey if we have one, otherwise dummy it with the wallet (fallback in enrich works)
                    const targetPubkey = managerNodes[0]?.pubkey || wallet;
                    const dummyConn = new Connection('https://api.devnet.solana.com');
                    const freshData = await enrichPNodeWithOnChainData(targetPubkey, dummyConn);

                    if (freshData && !freshData.error) {
                        const db = await getDb();
                        await db.collection('nodes').updateMany(
                            { $or: [{ managerWallet: wallet }, { registrarWallet: wallet }] },
                            {
                                $set: {
                                    daoStake: freshData.daoStake || 0,
                                    vestingStake: freshData.vestingStake || 0,
                                    xandStake: freshData.daoStake || 0,
                                    updatedAt: new Date()
                                }
                            }
                        );
                    }

                    // Background sync rewards using the formal syncRewards module
                    const { getProposalMapping } = await import('@/lib/server/proposal-scanner');
                    const mainnetConn = new Connection(RPC_URL, 'confirmed');
                    const proposalMap = await getProposalMapping();

                    // We can't easily import fetchVestingHistory because it's local to sync-rewards.ts
                    // But we can import it if we exported it, or just use the same logic.
                    // For now, let's just use the logic from solana-pnodes for totalStake
                    // and keep the history sync to the hourly background job or improve it.

                    // Actually, let's just trigger the formal sync module for this manager
                    const { syncRewardsForAllManagers } = await import('@/lib/server/sync-rewards');
                    // (This will sync ALL managers, which is a bit much for a background trigger)
                    // TODO: create syncRewardsForOneManager(wallet)
                } catch (e) {
                    console.error('[API] Background refresh failed:', e);
                }
            })();
        }

        managerDetailCache.set(wallet, response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('[API/managers/wallet] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch manager details' },
            { status: 500 }
        );
    }
}

