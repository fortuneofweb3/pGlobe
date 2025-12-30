import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from '@/lib/server/cache-utils';

const managerDetailCache = new SimpleCache<any>(0.5); // 30 second cache for quick navigation

// Fetch vesting schedule directly from chain
async function fetchVestingHistoryFromChain(walletStr: string) {
    const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
    const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

    const connection = new Connection(RPC_URL, 'confirmed');
    const managerWallet = new PublicKey(walletStr);

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

            schedule.push({
                amount,
                unlockDate: new Date(tStart * 1000),
                status,
                isGenesis: tStart === 0
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

        const cached = managerDetailCache.get(wallet);
        if (cached) {
            return NextResponse.json(cached);
        }

        const { getNodesByManager } = await import('@/lib/server/mongodb-nodes');

        let managerNodes;
        try {
            managerNodes = await getNodesByManager(wallet);
        } catch (dbError: any) {
            // Database connection error - return 500, not 404
            console.error('[API] Database error:', dbError.message);
            return NextResponse.json(
                { success: false, error: 'Database temporarily unavailable. Please try again in a few seconds.' },
                { status: 503 }
            );
        }

        if (managerNodes.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Manager not found' },
                { status: 404 }
            );
        }

        // 2. Perform REAL-TIME REFETCH for stake/rewards
        let freshDaoStake = 0;
        let freshVestingStake = 0;
        let vestingHistory: any[] = [];

        try {
            const { enrichPNodeWithOnChainData } = await import('@/lib/server/solana-pnodes');

            // Fetch stake data
            const dummyConn = new Connection('https://api.devnet.solana.com');
            const freshData = await enrichPNodeWithOnChainData(wallet, dummyConn);

            if (freshData && !freshData.error) {
                freshDaoStake = freshData.daoStake || 0;
                freshVestingStake = freshData.vestingStake || 0;

                // Background DB update for nodes
                const { getDb } = await import('@/lib/server/mongodb-nodes');
                const db = await getDb();
                db.collection('nodes').updateMany(
                    { managerWallet: wallet },
                    {
                        $set: {
                            daoStake: freshDaoStake,
                            vestingStake: freshVestingStake,
                            xandStake: freshDaoStake,
                            updatedAt: new Date()
                        }
                    }
                ).catch(e => console.error('[API] Background DB update failed:', e));
            }

            // Fetch vesting history in parallel
            vestingHistory = await fetchVestingHistoryFromChain(wallet);

            // Background update for rewards
            const { getDb } = await import('@/lib/server/mongodb-nodes');
            const db = await getDb();
            db.collection('manager_rewards').updateOne(
                { managerWallet: wallet },
                {
                    $set: {
                        managerWallet: wallet,
                        history: vestingHistory,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            ).catch(e => console.error('[API] Background rewards update failed:', e));

        } catch (e) {
            console.error('[API] Real-time refetch failed, falling back to DB values:', e);
            // Fallback to what we have in DB
            freshDaoStake = managerNodes.reduce((max, n) => Math.max(max, n.daoStake || 0), 0);
            freshVestingStake = managerNodes.reduce((max, n) => Math.max(max, n.vestingStake || 0), 0);

            // Try to get cached rewards history
            try {
                const { getDb } = await import('@/lib/server/mongodb-nodes');
                const db = await getDb();
                const rewards = await db.collection('manager_rewards').findOne({ managerWallet: wallet });
                vestingHistory = rewards?.history || [];
            } catch { }
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
            })),
            rewards: {
                history: vestingHistory
            },
            associatedWallets: Array.from(associatedWallets)
        };

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

