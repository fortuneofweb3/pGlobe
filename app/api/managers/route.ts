import { NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';

export const dynamic = 'force-dynamic';

interface Manager {
    wallet: string; // The primary wallet (Buyer if known, otherwise Registrar)
    associatedWallets: string[]; // Other wallets merged into this identity

    registeredNodes: number; // Sum from all associated wallets
    purchasedNodes: number;  // (In derived view, this is just equal to registeredNodes for now, or we can infer "1" per buyer?)
    // Note: User said "just add buyer and registrar field under a node". 
    // We can't know purely from node data how many "purchases" a buyer has if they haven't registered them.
    // So for "Purchased Nodes", we will count 1 per unique Buyer wallet we see? 
    // Or just set it to match registered count? Use registered count for now to be safe.

    knownNodes: {
        pubkey: string;
        status: string;
        version?: string;
        credits?: number;
        location?: string;
        role?: 'buyer' | 'registrar';
    }[];

    totalCredits: number;
    onlineCount: number;
    source: 'mainnet' | 'devnet' | 'both';
}

export async function GET() {
    try {
        // Fetch all nodes
        const nodes = await getAllNodes();

        // Initialize Manager Map
        const managerMap = new Map<string, Manager>();

        // Helper to get or create manager
        const getOrCreateManager = (wallet: string): Manager => {
            if (!managerMap.has(wallet)) {
                managerMap.set(wallet, {
                    wallet,
                    associatedWallets: [],
                    registeredNodes: 0,
                    purchasedNodes: 0,
                    knownNodes: [],
                    totalCredits: 0,
                    onlineCount: 0,
                    source: 'devnet' // Default, will update
                });
            }
            return managerMap.get(wallet)!;
        };

        // Pass 1: Identify Links (Registrar -> Buyer)
        // If a node has both managerWallet AND registrarWallet, and they are different,
        // we know that ReistrarWallet is "owned" by ManagerWallet.
        const registrarToBuyer = new Map<string, string>();

        for (const node of nodes) {
            if (node.managerWallet && node.registrarWallet && node.managerWallet !== node.registrarWallet) {
                registrarToBuyer.set(node.registrarWallet, node.managerWallet);
            }
        }

        // Pass 2: Process Nodes into Managers
        for (const node of nodes) {
            // Determine the "Primary Identity" for this node.
            // 1. If it has a Manager Wallet (Buyer), that is the Primary.
            // 2. If it has a Registrar Wallet, check if that Registrar is linked to a Buyer.
            // 3. If Registrar is not linked, the Registrar itself is the Primary.

            let primaryWallet: string | undefined;
            let role: 'buyer' | 'registrar' = 'registrar'; // Default implication

            if (node.managerWallet) {
                primaryWallet = node.managerWallet;
                role = 'buyer'; // Direct buyer link
            } else if (node.registrarWallet) {
                if (registrarToBuyer.has(node.registrarWallet)) {
                    primaryWallet = registrarToBuyer.get(node.registrarWallet);
                    role = 'registrar'; // Linked via registrar
                } else {
                    primaryWallet = node.registrarWallet;
                    role = 'registrar'; // Standalone registrar
                }
            }

            if (!primaryWallet) continue; // Skip nodes with absolutely no wallet info (unlikely)

            const manager = getOrCreateManager(primaryWallet);

            // Update Source hint
            if (role === 'buyer') {
                if (manager.source === 'devnet') manager.source = 'both'; // If was devnet, now both
                else if (manager.source !== 'both') manager.source = 'mainnet';
            } else {
                if (manager.source === 'mainnet') manager.source = 'both';
            }

            // Link Associated Wallet if needed
            // If this node came via a Registrar wallet that isn't the primary, valid link
            if (node.registrarWallet && node.registrarWallet !== primaryWallet) {
                if (!manager.associatedWallets.includes(node.registrarWallet)) {
                    manager.associatedWallets.push(node.registrarWallet);
                }
            }

            // Add Node Stats
            // Avoid duplicates in knownNodes (though iterating nodes once should be safe)
            if (!manager.knownNodes.some(kn => kn.pubkey === (node.pubkey || node.publicKey))) {
                manager.knownNodes.push({
                    pubkey: node.pubkey || node.publicKey || '',
                    status: node.status || 'offline',
                    version: node.version,
                    credits: node.credits,
                    location: node.location,
                    role
                });

                manager.registeredNodes++;
                // Heuristic: If we see a node with a Manager Wallet, that counts as a Purchase too.
                if (role === 'buyer') {
                    manager.purchasedNodes++;
                }

                manager.totalCredits += node.credits || 0;
                if (node.status === 'online') manager.onlineCount++;
            }
        }

        // Convert to array and sort
        const managers = Array.from(managerMap.values())
            .filter(m => m.knownNodes.length > 0) // Only show managers with nodes
            .sort((a, b) => b.knownNodes.length - a.knownNodes.length);

        return NextResponse.json({
            success: true,
            count: managers.length,
            totalRegisteredNodes: managers.reduce((s, m) => s + m.registeredNodes, 0),
            totalPurchasedNodes: managers.reduce((s, m) => s + m.purchasedNodes, 0),
            managers,
        });

    } catch (error) {
        console.error('[API/managers] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch managers' },
            { status: 500 }
        );
    }
}
