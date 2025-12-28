import { NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

interface Manager {
    wallet: string; // The primary wallet (Buyer if known, otherwise Registrar)
    associatedWallets: string[]; // Other wallets merged into this identity

    registeredNodes: number; // Sum from all associated wallets
    purchasedNodes: number;  // From Mainnet BuypNode

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
        // Fetch all data in parallel
        const [nodes, mainnetWallets, devnetManagers] = await Promise.all([
            getAllNodes(),
            fetchMainnetWallets(),
            fetchDevnetManagers()
        ]);

        // 1. Build a map of RegistrarWallet -> BuyerWallet based on known links
        const registrarToBuyer = new Map<string, string>();
        for (const node of nodes) {
            if (node.managerWallet && node.registrarWallet && node.managerWallet !== node.registrarWallet) {
                registrarToBuyer.set(node.registrarWallet, node.managerWallet);
            }
        }

        // 2. Initialize Manager Map with all Mainnet Buyers
        const managerMap = new Map<string, Manager>();

        for (const wallet of mainnetWallets) {
            managerMap.set(wallet, {
                wallet,
                associatedWallets: [],
                registeredNodes: 0,
                purchasedNodes: 1, // Each Mainnet account is 1 purchase
                knownNodes: [],
                totalCredits: 0,
                onlineCount: 0,
                source: 'mainnet'
            });
        }

        // 3. Process Devnet Managers (Registrars)
        // Merge them into Buyers if linked, otherwise create new entries
        for (const { wallet, registeredCount, purchasedCount } of devnetManagers) {
            const targetBuyer = registrarToBuyer.get(wallet);

            if (targetBuyer && managerMap.has(targetBuyer)) {
                // LINKED: Merge this Registrar into the Buyer's identity
                const buyer = managerMap.get(targetBuyer)!;
                buyer.registeredNodes += registeredCount;
                // Don't double count purchases if they are separate wallets
                // buyer.purchasedNodes += purchasedCount; 
                buyer.associatedWallets.push(wallet);
                buyer.source = 'both';

            } else if (managerMap.has(wallet)) {
                // SAME WALLET: It's the same address on both networks
                const existing = managerMap.get(wallet)!;
                existing.registeredNodes += registeredCount;
                existing.source = 'both';

            } else {
                // UNLINKED: Create a new Registrar-only identity
                managerMap.set(wallet, {
                    wallet,
                    associatedWallets: [],
                    registeredNodes: registeredCount,
                    purchasedNodes: purchasedCount,
                    knownNodes: [],
                    totalCredits: 0,
                    onlineCount: 0,
                    source: 'devnet'
                });
            }
        }

        // 4. Populate Nodes
        for (const node of nodes) {
            let primaryManagerWallet = node.managerWallet;

            // If no manager wallet, or manager wallet not in map, try registrar link
            if (!primaryManagerWallet && node.registrarWallet) {
                if (registrarToBuyer.has(node.registrarWallet)) {
                    primaryManagerWallet = registrarToBuyer.get(node.registrarWallet);
                } else {
                    primaryManagerWallet = node.registrarWallet;
                }
            }

            // If we have a wallet but it's not in the map yet (e.g. Manager PDA missing but Registry exists)
            if (primaryManagerWallet && !managerMap.has(primaryManagerWallet)) {
                managerMap.set(primaryManagerWallet, {
                    wallet: primaryManagerWallet,
                    associatedWallets: [],
                    registeredNodes: 0,
                    purchasedNodes: 0,
                    knownNodes: [],
                    totalCredits: 0,
                    onlineCount: 0,
                    source: 'devnet' // Assumed devnet if coming from registrar link
                });
            }

            // If we still have a wallet to attach to
            if (primaryManagerWallet && managerMap.has(primaryManagerWallet)) {
                const manager = managerMap.get(primaryManagerWallet)!;

                // Determine role
                let role: 'buyer' | 'registrar' | undefined = undefined;
                if (node.managerWallet === manager.wallet) role = 'buyer';
                else if (node.registrarWallet === manager.wallet) role = 'registrar'; // unlikely for primary
                else if (manager.associatedWallets.includes(node.registrarWallet || '')) role = 'registrar';

                addNodeToManager(manager, node, role);
            }
        }

        // Convert to array and sort
        const managers = Array.from(managerMap.values())
            .filter(m => m.registeredNodes > 0 || m.purchasedNodes > 0 || m.knownNodes.length > 0)
            .sort((a, b) => {
                const aTotal = Math.max(a.registeredNodes, a.purchasedNodes, a.knownNodes.length);
                const bTotal = Math.max(b.registeredNodes, b.purchasedNodes, b.knownNodes.length);
                return bTotal - aTotal;
            });

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

function addNodeToManager(manager: Manager, node: any, role?: 'buyer' | 'registrar') {
    // Avoid duplicates
    if (manager.knownNodes.some(n => n.pubkey === (node.pubkey || node.publicKey))) return;

    manager.knownNodes.push({
        pubkey: node.pubkey || node.publicKey || '',
        status: node.status || 'offline',
        version: node.version,
        credits: node.credits,
        location: node.location,
        role
    });

    manager.totalCredits += node.credits || 0;
    if (node.status === 'online') {
        manager.onlineCount++;
    }
}

async function fetchMainnetWallets(): Promise<string[]> {
    try {
        const conn = new Connection(MAINNET_RPC, 'confirmed');
        const accounts = await conn.getProgramAccounts(MAINNET_PROGRAM, {
            filters: [{ dataSize: 48 }]
        });
        return accounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58());
    } catch (error) {
        console.error('[API/managers] Error fetching Mainnet wallets:', error);
        return [];
    }
}

async function fetchDevnetManagers(): Promise<{ wallet: string; registeredCount: number; purchasedCount: number }[]> {
    try {
        const conn = new Connection(DEVNET_RPC, 'confirmed');
        const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
            filters: [{ dataSize: 34 }] // Manager PDAs are 34 bytes
        });

        return accounts
            .map(a => {
                const wallet = new PublicKey(a.account.data.slice(0, 32)).toBase58();
                const purchasedCount = a.account.data[32];
                const registeredCount = a.account.data[33];
                return { wallet, registeredCount, purchasedCount };
            })
            .filter(m => m.registeredCount > 0 || m.purchasedCount > 0);
    } catch (error) {
        console.error('[API/managers] Error fetching Devnet managers:', error);
        return [];
    }
}
