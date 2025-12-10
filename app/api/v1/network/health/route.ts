/**
 * Public API v1: Network health metrics
 * GET /api/v1/network/health
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';
import { getAllNodes } from '@/lib/server/mongodb-nodes';
import { calculateNetworkHealth } from '@/lib/utils/network-health';

export const GET = withAPIAuth(async (request: Request) => {
  try {
    const nodes = await getAllNodes();
    
    if (nodes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No nodes found',
      }, { status: 404 });
    }

    // Calculate health metrics
    const onlineNodes = nodes.filter(n => n.status === 'online');
    const offlineNodes = nodes.filter(n => n.status === 'offline');
    const syncingNodes = nodes.filter(n => n.status === 'syncing');

    const totalUptime = nodes.reduce((sum, n) => sum + (n.uptime || 0), 0);
    const avgUptime = nodes.length > 0 ? totalUptime / nodes.length : 0;

    const nodesWithLatency = nodes.filter(n => n.latency !== undefined);
    const avgLatency = nodesWithLatency.length > 0
      ? nodesWithLatency.reduce((sum, n) => sum + (n.latency || 0), 0) / nodesWithLatency.length
      : null;

    const totalStorage = nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
    const usedStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const storageUsagePercent = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;

    const totalCPU = nodes.filter(n => n.cpuPercent !== undefined).reduce((sum, n) => sum + (n.cpuPercent || 0), 0);
    const avgCPU = nodes.filter(n => n.cpuPercent !== undefined).length > 0
      ? totalCPU / nodes.filter(n => n.cpuPercent !== undefined).length
      : null;

    // Calculate network health score
    const healthScore = calculateNetworkHealth(nodes);

    // Version distribution
    const versionCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const version = node.version || 'unknown';
      versionCounts[version] = (versionCounts[version] || 0) + 1;
    });

    // Geographic distribution
    const countryCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const country = node.locationData?.countryCode || 'unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        healthScore,
        totalNodes: nodes.length,
        onlineNodes: onlineNodes.length,
        offlineNodes: offlineNodes.length,
        syncingNodes: syncingNodes.length,
        uptime: {
          average: avgUptime,
          averageDays: avgUptime / 86400,
        },
        latency: {
          average: avgLatency,
        },
        storage: {
          total: totalStorage,
          used: usedStorage,
          usagePercent: storageUsagePercent,
        },
        cpu: {
          average: avgCPU,
        },
        versionDistribution: versionCounts,
        geographicDistribution: countryCounts,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to calculate network health' },
      { status: 500 }
    );
  }
});

