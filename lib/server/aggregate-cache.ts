/**
 * Aggregate Cache
 * 
 * Pre-computed aggregates for network stats and country data
 * to avoid expensive calculations on every AI query.
 */

import { PNode } from '@/lib/types/pnode';
import { calculateNetworkHealth } from '@/lib/utils/network-health';

interface NetworkStats {
    totalNodes: number;
    onlineNodes: number;
    syncingNodes: number;
    offlineNodes: number;
    totalStorageBytes: number;
    totalCredits: number;
    avgUptimeSeconds: number;
    healthScore: number;
    countryDistribution: Record<string, number>;
    versionDistribution: Record<string, number>;
    timestamp: number;
}

interface CountryStats {
    country: string;
    countryCode: string;
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    syncingNodes: number;
    totalStorage: number;
    usedStorage: number;
    totalCredits: number;
    avgCPU: number;
    avgRAM: number;
    totalPacketsReceived: number;
    totalPacketsSent: number;
    totalActiveStreams: number;
    versionDistribution: Record<string, number>;
    cityCount: number;
    cities: string[];
    healthScore: number;
    timestamp: number;
}

class AggregateCache {
    private networkStatsCache: NetworkStats | null = null;
    private countryStatsCache: Map<string, CountryStats> = new Map();
    private lastComputeTime: number = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Compute network stats from nodes
     */
    computeNetworkStats(nodes: any[]): NetworkStats {
        const onlineNodes = nodes.filter(n => (n.status || n.s) === 'online').length;
        const syncingNodes = nodes.filter(n => (n.status || n.s) === 'syncing').length;
        const offlineNodes = nodes.filter(n => (n.status || n.s) === 'offline').length;

        const totalStorageBytes = nodes.reduce((sum, n) => sum + (n.storageCapacity || n.sc || 0), 0);
        const totalCredits = nodes.reduce((sum, n) => sum + (n.credits || n.cr || 0), 0);
        const totalUptime = nodes.reduce((sum, n) => sum + (n.uptime || n.us || 0), 0);
        const avgUptimeSeconds = nodes.length > 0 ? totalUptime / nodes.length : 0;

        // Country distribution
        const countryDistribution: Record<string, number> = {};
        nodes.forEach(n => {
            const country = n.locationData?.countryCode || n.c || 'Unknown';
            countryDistribution[country] = (countryDistribution[country] || 0) + 1;
        });

        // Version distribution
        const versionDistribution: Record<string, number> = {};
        nodes.forEach(n => {
            const version = n.version || n.v || 'unknown';
            versionDistribution[version] = (versionDistribution[version] || 0) + 1;
        });

        // Health score
        const healthScore = calculateNetworkHealth(nodes.map(n => ({
            id: n.id || n.pubkey || n.p,
            status: n.status || n.s,
            version: n.version || n.v,
            locationData: {
                country: n.locationData?.country || n.c,
                city: n.locationData?.city || n.cy,
            }
        } as PNode))).overall;

        return {
            totalNodes: nodes.length,
            onlineNodes,
            syncingNodes,
            offlineNodes,
            totalStorageBytes,
            totalCredits,
            avgUptimeSeconds,
            healthScore,
            countryDistribution,
            versionDistribution,
            timestamp: Date.now(),
        };
    }

    /**
     * Compute country stats from nodes
     */
    computeCountryStats(country: string, countryCode: string, nodes: any[]): CountryStats {
        const totalNodes = nodes.length;
        const onlineNodes = nodes.filter(n => (n.status || n.s) === 'online').length;
        const offlineNodes = nodes.filter(n => (n.status || n.s) === 'offline' || !(n.status || n.s)).length;
        const syncingNodes = nodes.filter(n => (n.status || n.s) === 'syncing').length;

        const totalStorage = nodes.reduce((sum, n) => sum + (n.storageCapacity || n.sc || 0), 0);
        const usedStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
        const totalCredits = nodes.reduce((sum, n) => sum + (n.credits || n.cr || 0), 0);

        const cpuValues = nodes
            .map(n => n.cpuPercent || n.cpu)
            .filter((val): val is number => val !== undefined && val !== null && val >= 0);
        const avgCPU = cpuValues.length > 0
            ? cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length
            : 0;

        const ramValues = nodes
            .map(n => {
                const ramTotal = n.ramTotal || n.rt || 0;
                const ramUsed = n.ramUsed || n.ru || 0;
                if (!ramTotal || ramTotal === 0) return null;
                return (ramUsed / ramTotal) * 100;
            })
            .filter((val): val is number => val !== null && val !== undefined);
        const avgRAM = ramValues.length > 0
            ? ramValues.reduce((sum, val) => sum + val, 0) / ramValues.length
            : 0;

        const totalPacketsReceived = nodes.reduce((sum, n) => sum + (n.packetsReceived || n.pr || 0), 0);
        const totalPacketsSent = nodes.reduce((sum, n) => sum + (n.packetsSent || n.ps || 0), 0);
        const totalActiveStreams = nodes.reduce((sum, n) => sum + (n.activeStreams || n.as || 0), 0);

        // Version distribution
        const versionDistribution: Record<string, number> = {};
        nodes.forEach(n => {
            const version = n.version || n.v || 'unknown';
            versionDistribution[version] = (versionDistribution[version] || 0) + 1;
        });

        // City distribution
        const cities = new Set<string>();
        nodes.forEach(n => {
            const city = n.locationData?.city || n.cy;
            if (city) cities.add(city);
        });

        const healthScore = calculateNetworkHealth(nodes.map(n => ({
            id: n.id || n.pubkey || n.p,
            status: n.status || n.s,
            version: n.version || n.v,
            locationData: {
                country: n.locationData?.country || n.c,
                city: n.locationData?.city || n.cy,
            }
        } as PNode))).overall;

        return {
            country,
            countryCode,
            totalNodes,
            onlineNodes,
            offlineNodes,
            syncingNodes,
            totalStorage,
            usedStorage,
            totalCredits,
            avgCPU: Math.round(avgCPU * 10) / 10,
            avgRAM: Math.round(avgRAM * 10) / 10,
            totalPacketsReceived,
            totalPacketsSent,
            totalActiveStreams,
            versionDistribution,
            cityCount: cities.size,
            cities: Array.from(cities).slice(0, 10),
            healthScore,
            timestamp: Date.now(),
        };
    }

    /**
     * Get cached network stats or compute if stale
     */
    getNetworkStats(nodes?: any[]): NetworkStats | null {
        const now = Date.now();

        // Return cached if fresh
        if (this.networkStatsCache && (now - this.networkStatsCache.timestamp) < this.CACHE_TTL) {
            return this.networkStatsCache;
        }

        // If nodes provided, compute and cache
        if (nodes) {
            this.networkStatsCache = this.computeNetworkStats(nodes);
            return this.networkStatsCache;
        }

        return null;
    }

    /**
     * Get cached country stats or compute if stale
     */
    getCountryStats(country: string, countryCode: string, nodes?: any[]): CountryStats | null {
        const cacheKey = `${country.toLowerCase()}_${countryCode}`;
        const cached = this.countryStatsCache.get(cacheKey);
        const now = Date.now();

        // Return cached if fresh
        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
            return cached;
        }

        // If nodes provided, compute and cache
        if (nodes) {
            const stats = this.computeCountryStats(country, countryCode, nodes);
            this.countryStatsCache.set(cacheKey, stats);
            return stats;
        }

        return null;
    }

    /**
     * Invalidate all caches
     */
    invalidate(): void {
        this.networkStatsCache = null;
        this.countryStatsCache.clear();
        this.lastComputeTime = 0;
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            networkStatsCached: !!this.networkStatsCache,
            countryCacheSize: this.countryStatsCache.size,
            lastComputeTime: this.lastComputeTime,
            cacheAge: this.networkStatsCache ? Date.now() - this.networkStatsCache.timestamp : null,
        };
    }
}

// Singleton instance
export const aggregateCache = new AggregateCache();
