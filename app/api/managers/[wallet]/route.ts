import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from '@/lib/server/cache-utils';

const managerDetailCache = new SimpleCache<any>(0.5); // 30 second cache for quick navigation

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

        const nodes = await getAllNodes();

        // 1. Identify all nodes "owned" by this wallet
        const managerNodes = nodes.filter(n =>
            n.managerWallet === wallet ||
            n.registrarWallet === wallet
        );

        if (managerNodes.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Manager not found' },
                { status: 404 }
            );
        }

        // 2. Perform REAL-TIME REFETCH for stake/rewards
        let freshDaoStake = 0;
        let freshVestingStake = 0;
        try {
            const { Connection } = await import('@solana/web3.js');
            // We use the Helius-powered functions from solana-pnodes
            const { fetchAndEnrichOnChainPNodes } = await import('@/lib/server/solana-pnodes');

            // To keep it simple and fast, we'll manually invoke the stake fetchers for this wallet
            // instead of a full node scan if we just want the manager's total
            const { Connection: SolanaConn, PublicKey: SolanaPK } = await import('@solana/web3.js');
            // We need to reach into the internal fetchers or use the enrichment flow
            // For now, let's use the exported enrichPNodeWithOnChainData if we treat the wallet as a pubkey
            const { enrichPNodeWithOnChainData } = await import('@/lib/server/solana-pnodes');

            // We use a dummy connection because enrichment function creates its own internal Helius connection
            const dummyConn = new Connection('https://api.devnet.solana.com');
            const freshData = await enrichPNodeWithOnChainData(wallet, dummyConn);

            if (freshData && !freshData.error) {
                freshDaoStake = freshData.daoStake || 0;
                freshVestingStake = freshData.vestingStake || 0;

                // Trigger background DB update for all nodes of this manager
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
        } catch (e) {
            console.error('[API] Real-time refetch failed, falling back to DB values:', e);
            // Fallback to what we have in DB
            freshDaoStake = managerNodes.reduce((max, n) => Math.max(max, n.daoStake || 0), 0);
            freshVestingStake = managerNodes.reduce((max, n) => Math.max(max, n.vestingStake || 0), 0);
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
