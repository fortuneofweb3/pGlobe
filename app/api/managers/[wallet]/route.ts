import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    try {
        const { wallet } = await params;
        const nodes = await getAllNodes();

        // Find all nodes for this manager
        const managerNodes = nodes.filter(n => n.managerWallet === wallet);

        if (managerNodes.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Manager not found' },
                { status: 404 }
            );
        }

        // Calculate stats
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
        };

        return NextResponse.json({
            success: true,
            manager: stats,
            nodes: managerNodes.map(n => ({
                pubkey: n.pubkey || n.publicKey,
                address: n.address,
                status: n.status,
                version: n.version,
                uptime: n.uptime,
                credits: n.credits,
                storageCapacity: n.storageCapacity,
                storageUsed: n.storageUsed,
                location: n.location,
                locationData: n.locationData,
                lastSeen: n.lastSeen,
            })),
        });
    } catch (error) {
        console.error('[API/managers/wallet] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch manager details' },
            { status: 500 }
        );
    }
}
