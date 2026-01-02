import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from '@/lib/server/cache-utils';
import { getProposalMapping } from '@/lib/server/proposal-scanner';
import { getNodesByManager, getDb } from '@/lib/server/mongodb-nodes';
import { enrichPNodeWithOnChainData } from '@/lib/server/solana-pnodes';
import { syncRewardsForManager } from '@/lib/server/sync-rewards';

const managerDetailCache = new SimpleCache<any>(0.5); // 30 second cache for quick navigation

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');


export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    try {
        const { wallet } = await params;
        const { searchParams } = new URL(request.url);
        const network = searchParams.get('network') || 'all';

        // 1. FAST PATH: Check cache first
        const cacheKey = `${wallet}:${network}`;
        const cached = managerDetailCache.get(cacheKey);
        if (cached) {
            console.log(`[API] 🚀 Cache hit for ${wallet} (${network})`);
            return NextResponse.json(cached);
        }

        // 2. Fetch all data from DB FIRST
        let managerNodes;
        try {
            console.log(`[API] 📥 Fetching nodes for ${wallet} (${network})...`);
            managerNodes = await getNodesByManager(wallet, network);
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

        managerDetailCache.set(cacheKey, response);

        if (isStale) {
            // Truly FIRE AND FORGET background refresh
            setTimeout(async () => {
                const startRefresh = Date.now();
                try {
                    console.log(`[API] 🔄 Starting background refresh for manager: ${wallet}`);

                    // 1. Refresh node metadata (DAO Stake, Eras, etc)
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
                        console.log(`[API] ✅ Node metadata refreshed for ${wallet}`);
                    }

                    // 2. Targeted Rewards Sync
                    await syncRewardsForManager(wallet);

                    const duration = Date.now() - startRefresh;
                    console.log(`[API] ✨ Background refresh for ${wallet} completed in ${duration}ms`);
                } catch (e) {
                    console.error(`[API] ❌ Background refresh failed for ${wallet}:`, e);
                }
            }, 0);
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('[API/managers/wallet] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch manager details' },
            { status: 500 }
        );
    }
}

