
import { getAllNodes, getNodesByManager, getNodeByPubkey } from '@/lib/server/mongodb-nodes';
import { getHistoricalSnapshots } from '@/lib/server/mongodb-history';
import { getActivityLogs, ActivityLog } from '@/lib/server/mongodb-activity';
import { XANDEUM_ERAS, getItemForVersion } from '@/lib/constants/eras';
import { PNode } from '@/lib/types/pnode';

// ============================================================================
// TYPES
// ============================================================================

export interface ManagerStats {
    wallet: string;
    totalNodes: number;
    onlineNodes: number;
    totalCredits: number;
    totalXandStake: number;
    networkDistribution: {
        mainnet: number;
        devnet: number;
        unknown: number;
    };
    topNodes: Array<{
        pubkey: string;
        version: string;
        status: string;
        credits: number;
    }>;
}

export interface NetworkStats {
    network: 'mainnet' | 'devnet' | 'all';
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalCredits: number;
    avgUptime: number;
    versions: Record<string, number>;
    latestHealthScore?: number;
}

export interface EraStats {
    name: string;
    description: string;
    boost: number;
    totalNodes: number;
    onlineNodes: number;
    minItem: number;
    maxItem?: number;
}

// ============================================================================
// MANAGER QUERIES
// ============================================================================

/**
 * Get detailed stats for a specific manager
 */
export async function getManagerStats(wallet: string): Promise<ManagerStats> {
    const nodes = await getNodesByManager(wallet);

    const stats: ManagerStats = {
        wallet,
        totalNodes: nodes.length,
        onlineNodes: 0,
        totalCredits: 0,
        totalXandStake: 0,
        networkDistribution: {
            mainnet: 0,
            devnet: 0,
            unknown: 0
        },
        topNodes: []
    };

    for (const node of nodes) {
        if (node.status === 'online') stats.onlineNodes++;
        stats.totalCredits += node.credits || 0;
        stats.totalXandStake = Math.max(stats.totalXandStake, node.xandStake || 0); // Stake is often per wallet, so max is safer than sum if repeated

        const net = node.network || 'unknown';
        if (net === 'mainnet' || net === 'both') stats.networkDistribution.mainnet++;
        else if (net === 'devnet') stats.networkDistribution.devnet++;
        else stats.networkDistribution.unknown++;
    }

    // Get top 5 nodes by credits
    stats.topNodes = nodes
        .sort((a, b) => (b.credits || 0) - (a.credits || 0))
        .slice(0, 5)
        .map(n => ({
            pubkey: n.pubkey || n.publicKey || 'unknown',
            version: n.version || 'unknown',
            status: n.status || 'unknown',
            credits: n.credits || 0
        }));

    return stats;
}

/**
 * Get top managers by total stake
 */
export async function getTopManagers(limit: number = 10): Promise<Array<{ wallet: string; stake: number; nodes: number }>> {
    // This is a heavy operation, effectively re-implementing the managers route logic
    // In a real optimized scenario, we'd want a cached pre-aggregated collection
    const nodes = await getAllNodes();
    const managerMap = new Map<string, { wallet: string; stake: number; nodes: number }>();

    for (const node of nodes) {
        const wallet = node.managerWallet || node.registrarWallet;
        if (!wallet) continue;

        if (!managerMap.has(wallet)) {
            managerMap.set(wallet, { wallet, stake: 0, nodes: 0 });
        }
        const entry = managerMap.get(wallet)!;
        entry.nodes++;
        entry.stake = Math.max(entry.stake, node.xandStake || 0); // Max assumption
    }

    return Array.from(managerMap.values())
        .sort((a, b) => b.stake - a.stake)
        .slice(0, limit);
}

// ============================================================================
// NETWORK QUERIES
// ============================================================================

/**
 * Get aggregate stats for a specific network
 */
export async function getNetworkStats(network: 'mainnet' | 'devnet' | 'all' = 'all'): Promise<NetworkStats> {
    const nodes = await getAllNodes(network);

    const stats: NetworkStats = {
        network,
        totalNodes: nodes.length,
        onlineNodes: 0,
        offlineNodes: 0,
        totalCredits: 0,
        avgUptime: 0,
        versions: {}
    };

    let totalUptime = 0;
    let uptimeCount = 0;

    for (const node of nodes) {
        if (node.status === 'online') stats.onlineNodes++;
        else if (node.status === 'offline') stats.offlineNodes++;

        stats.totalCredits += node.credits || 0;

        // Versions
        const v = node.version || 'unknown';
        stats.versions[v] = (stats.versions[v] || 0) + 1;

        // Uptime
        if (node.uptime) {
            totalUptime += node.uptime;
            uptimeCount++;
        }
    }

    stats.avgUptime = uptimeCount > 0 ? totalUptime / uptimeCount : 0;

    // Attempt to get latest health score from history
    try {
        const snapshots = await getHistoricalSnapshots(undefined, undefined, 1, network === 'all' ? undefined : network);
        if (snapshots && snapshots.length > 0) {
            stats.latestHealthScore = snapshots[snapshots.length - 1].networkHealthScore;
        }
    } catch (e) {
        // Ignore history error
    }

    return stats;
}

// ============================================================================
// HISTORICAL QUERIES
// ============================================================================

/**
 * Get network trend (daily averages) for the last N days
 */
export async function getNetworkTrend(days: number = 7, network?: 'mainnet' | 'devnet'): Promise<Array<{ date: string; nodes: number; online: number }>> {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

    // Get all snapshots in range
    const snapshots = await getHistoricalSnapshots(startTime, endTime, 1000, network); // Limit 1000 should cover 7 days of 10-min intervals easily (6*24*7 = 1008, close enough)

    // Aggregate by day
    const dailyMap = new Map<string, { count: number; totalNodes: number; totalOnline: number }>();

    for (const snap of snapshots) {
        const date = snap.date; // YYYY-MM-DD
        if (!dailyMap.has(date)) {
            dailyMap.set(date, { count: 0, totalNodes: 0, totalOnline: 0 });
        }
        const entry = dailyMap.get(date)!;
        entry.count++;
        entry.totalNodes += snap.totalNodes;
        entry.totalOnline += snap.onlineNodes;
    }

    // Calculate averages
    return Array.from(dailyMap.entries())
        .map(([date, data]) => ({
            date,
            nodes: Math.round(data.totalNodes / data.count),
            online: Math.round(data.totalOnline / data.count)
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// ERA QUERIES
// ============================================================================

/**
 * Get stats for all Eras
 */
export async function getEraStats(): Promise<EraStats[]> {
    const nodes = await getAllNodes();

    // Initialize stats for each era
    const statsMap = new Map<string, EraStats>();
    for (const era of XANDEUM_ERAS) {
        statsMap.set(era.name, {
            name: era.name,
            description: era.description,
            boost: era.boost,
            totalNodes: 0,
            onlineNodes: 0,
            minItem: era.minItem,
            maxItem: era.maxItem
        });
    }

    // Aggregate nodes
    for (const node of nodes) {
        const version = node.version;
        const itemIndex = getItemForVersion(version);

        // Find matching era
        const era = XANDEUM_ERAS.find(e =>
            itemIndex >= e.minItem && (e.maxItem === undefined || itemIndex <= e.maxItem)
        ) || XANDEUM_ERAS[0]; // Default to Deep South

        const stats = statsMap.get(era.name);
        if (stats) {
            stats.totalNodes++;
            if (node.status === 'online') stats.onlineNodes++;
        }
    }

    return Array.from(statsMap.values());
}

/**
 * Get the current Era based on the majority of nodes or latest available version
 */
export async function getCurrentEra(): Promise<EraStats> {
    const stats = await getEraStats();

    // Strategy 1: The "latest" era defined in constants (The theoretical current era)
    // This is usually the last one in the list
    const roadmapEra = XANDEUM_ERAS[XANDEUM_ERAS.length - 1];

    // Strategy 2: The era with the updated nodes (The active current era)
    // For now, we return the one with the highest index that has > 0 nodes, 
    // OR just the roadmap target if we want to be aspirational.
    // Let's stick to the "Highest Active Era"

    const activeEras = stats.filter(e => e.totalNodes > 0);
    if (activeEras.length === 0) return stats[0];

    // Sort by minItem descending to find highest era
    activeEras.sort((a, b) => b.minItem - a.minItem);

    return activeEras[0];
}

// ============================================================================
// SPECIFIC NODE & ACTIVITY QUERIES
// ============================================================================

/**
 * Get detailed stats for a single node by Pubkey or IP (heuristic)
 */
export async function getNodeStats(identifier: string): Promise<PNode | null> {
    // If identifier looks like a Pubkey (length approx 32-44), try that first
    if (identifier.length >= 32) {
        const node = await getNodeByPubkey(identifier);
        if (node) return node;
    }

    // If not found or not a pubkey, try searching by IP (inefficient but useful for AI)
    // We fetch all nodes and find matching address
    // OPTIMIZE: If frequent, add index on address
    const allNodes = await getAllNodes();
    const node = allNodes.find(n => n.address?.includes(identifier));

    return node || null;
}

/**
 * Get recent activity logs
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityLog[]> {
    const logs = await getActivityLogs({ limit });
    return logs;
}
