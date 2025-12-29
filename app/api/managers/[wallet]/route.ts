import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from '@/lib/server/cache-utils';

const managerDetailCache = new SimpleCache<any>(2); // 2 minute cache

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
        // Ownership definitions:
        // - Direct Manager: node.managerWallet === wallet
        // - Direct Registrar: node.registrarWallet === wallet
        // - Linked Manager: node.registrarWallet points to this wallet via some other link (we can try to infer this)

        // For the details view, we want to show everything associated with this wallet.
        // We also need to know if this wallet is a "Mainnet Buyer" or "Devnet Registrar" or both.

        // Let's first find the matching nodes
        const managerNodes = nodes.filter(n =>
            n.managerWallet === wallet ||
            n.registrarWallet === wallet
        );

        if (managerNodes.length === 0) {
            // It might be a wallet that hasn't registered any nodes yet, but exists as a Buyer or Registrar?
            // For now, if no nodes, return 404 (or we could fetch from chain to verify existence)
            return NextResponse.json(
                { success: false, error: 'Manager not found' },
                { status: 404 }
            );
        }

        // 2. Identify associated wallets
        // If this wallet is a Buyer, find its Registrars.
        // If this wallet is a Registrar, find its Buyer? (Ideally we redirect to Buyer, but for now just show what we have)

        const associatedWallets = new Set<string>();
        for (const n of managerNodes) {
            if (n.managerWallet === wallet && n.registrarWallet && n.registrarWallet !== wallet) {
                associatedWallets.add(n.registrarWallet);
            }
            if (n.registrarWallet === wallet && n.managerWallet && n.managerWallet !== wallet) {
                associatedWallets.add(n.managerWallet);
            }
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
            associatedWallets: Array.from(associatedWallets) // Send to top level too
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
