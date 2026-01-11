import { getAllNodes, getAllNodesForManagers, getNodesByManager } from './mongodb-nodes';
import { getManagerPurchaseStats } from './manager-discovery';
import { PNode } from '../types/pnode';
import { Manager } from '@/app/api/managers/route';

/**
 * Common Manager Aggregation Logic
 */
export async function aggregateManagers(network: string = 'all'): Promise<{ managers: Manager[], stats: any }> {
    const [nodes, purchaseStats] = await Promise.all([
        getAllNodesForManagers(),
        getManagerPurchaseStats()
    ]);

    const managerMap = new Map<string, Manager>();

    const getOrCreateManager = (wallet: string): Manager => {
        if (!managerMap.has(wallet)) {
            managerMap.set(wallet, {
                wallet,
                associatedWallets: [],
                registeredNodes: 0,
                purchasedNodes: 0,
                knownNodes: [],
                totalCredits: 0,
                totalXandStake: 0,
                vestingStake: 0,
                onlineCount: 0,
                source: 'devnet',
                createdAt: undefined
            });
        }
        return managerMap.get(wallet)!;
    };

    const filteredNodes = network === 'all'
        ? nodes
        : nodes.filter(node => {
            const nodeNetwork = node.network || 'unknown';
            if (network === 'mainnet') return nodeNetwork === 'mainnet' || nodeNetwork === 'both';
            if (network === 'devnet') return nodeNetwork === 'devnet' || nodeNetwork === 'unknown';
            return true;
        });

    for (const node of filteredNodes) {
        let primaryWallet: string | undefined;
        let role: 'buyer' | 'registrar' = 'registrar';

        if (node.managerWallet) {
            primaryWallet = node.managerWallet;
            role = 'buyer';
        } else if (node.registrarWallet) {
            primaryWallet = node.registrarWallet;
            role = 'registrar';
        }

        if (!primaryWallet) continue;

        const manager = getOrCreateManager(primaryWallet);

        // Determine source based on node's actual network
        const nodeNetwork = node.network || 'unknown';
        if (nodeNetwork === 'mainnet') {
            if (manager.source === 'devnet') manager.source = 'both';
            else if (manager.source !== 'both') manager.source = 'mainnet';
        } else if (nodeNetwork === 'devnet' || nodeNetwork === 'unknown') {
            if (manager.source === 'mainnet') manager.source = 'both';
            // else keep as devnet (default)
        }

        if (node.registrarWallet && node.registrarWallet !== primaryWallet) {
            if (!manager.associatedWallets.includes(node.registrarWallet)) {
                manager.associatedWallets.push(node.registrarWallet);
            }
        }

        const nodePubkey = node.pubkey || node.publicKey || '';
        if (!manager.knownNodes.some(kn => kn.pubkey === nodePubkey)) {
            manager.knownNodes.push({
                pubkey: nodePubkey,
                status: node.status || 'offline',
                version: node.version,
                credits: node.credits,
                location: node.location,
                role,
                xandStake: node.xandStake,
                vestingStake: node.vestingStake,
                eraLabel: node.eraLabel,
                eraBoost: node.eraBoost
            });

            manager.registeredNodes++;
            if (role === 'buyer') manager.purchasedNodes++;
            manager.totalCredits += node.credits || 0;

            if (node.xandStake && node.xandStake > manager.totalXandStake) {
                manager.totalXandStake = node.xandStake;
            }
            if (node.vestingStake && node.vestingStake > manager.vestingStake) {
                manager.vestingStake = node.vestingStake;
            }

            if (node.status === 'online' || node.status === 'syncing') manager.onlineCount++;

            // Track earliest node createdAt as manager's join date
            const nodeCreatedAt = node.createdAt ? new Date(node.createdAt).toISOString() : undefined;
            if (nodeCreatedAt) {
                if (!manager.createdAt || nodeCreatedAt < manager.createdAt) {
                    manager.createdAt = nodeCreatedAt;
                }
            }
        }
    }

    let totalCredits = 0;
    let totalXandStakeAggregation = 0;
    let totalVestedRewards = 0;
    let activeManagersCount = 0;
    let totalRegisteredNodes = 0;

    managerMap.forEach((manager, wallet) => {
        if (purchaseStats.has(wallet)) {
            manager.totalPurchases = purchaseStats.get(wallet);
            if (manager.totalPurchases! > 0 && manager.source === 'devnet') {
                manager.source = 'both';
            }
        }

        totalCredits += manager.totalCredits;
        totalXandStakeAggregation += manager.totalXandStake;
        totalVestedRewards += manager.vestingStake;
        totalRegisteredNodes += manager.registeredNodes;
        if (manager.onlineCount > 0) activeManagersCount++;
    });

    const managers = Array.from(managerMap.values())
        .filter(m => m.knownNodes.length > 0)
        .sort((a, b) => (b.totalXandStake || 0) - (a.totalXandStake || 0) || b.knownNodes.length - a.knownNodes.length);

    const stats = {
        totalManagers: managers.length,
        activeManagers: activeManagersCount,
        totalRegisteredNodes,
        totalCredits,
        totalXandStake: totalXandStakeAggregation,
        totalVestedRewards,
        avgNodesPerManager: managers.length > 0 ? totalRegisteredNodes / managers.length : 0,
        avgCreditsPerManager: managers.length > 0 ? totalCredits / managers.length : 0,
    };

    return { managers, stats };
}

/**
 * Get Network Stats aggregated
 */
export async function aggregateNetworkStats(network: string = 'all'): Promise<any> {
    const nodes = await getAllNodes(network);

    const stats = {
        network,
        totalNodes: nodes.length,
        onlineNodes: 0,
        offlineNodes: 0,
        syncingNodes: 0,
        totalCredits: 0,
        avgUptime: 0,
        versions: {} as Record<string, number>,
        latestHealthScore: 100,
        timestamp: Date.now()
    };

    let totalUptime = 0;
    let uptimeCount = 0;

    for (const node of nodes) {
        if (node.status === 'online') stats.onlineNodes++;
        else if (node.status === 'syncing') stats.syncingNodes++;
        else stats.offlineNodes++;

        stats.totalCredits += node.credits || 0;
        const v = node.version || 'unknown';
        stats.versions[v] = (stats.versions[v] || 0) + 1;

        if (node.uptime) {
            totalUptime += node.uptime;
            uptimeCount++;
        }
    }

    stats.avgUptime = uptimeCount > 0 ? totalUptime / uptimeCount : 0;
    return stats;
}
