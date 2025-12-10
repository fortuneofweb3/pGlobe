/**
 * Public API v1: Trend analytics
 * GET /api/v1/analytics/trends
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';
import { getAllNodes } from '@/lib/server/mongodb-nodes';

export const GET = withAPIAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'uptime';
    const groupBy = searchParams.get('group_by') || 'version'; // version, country, status

    const nodes = await getAllNodes();
    
    if (nodes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No nodes found',
      }, { status: 404 });
    }

    // Group nodes by the specified field
    const groups: Record<string, any[]> = {};
    
    nodes.forEach(node => {
      let key: string;
      if (groupBy === 'version') {
        key = node.version || 'unknown';
      } else if (groupBy === 'country') {
        key = node.locationData?.countryCode || 'unknown';
      } else if (groupBy === 'status') {
        key = node.status || 'unknown';
      } else {
        key = 'all';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(node);
    });

    // Calculate trends for each group
    const trends: Record<string, any> = {};
    
    Object.entries(groups).forEach(([key, groupNodes]) => {
      if (metric === 'uptime') {
        const avg = groupNodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / groupNodes.length;
        trends[key] = {
          count: groupNodes.length,
          average: avg,
          averageDays: avg / 86400,
          min: Math.min(...groupNodes.map(n => n.uptime || 0)),
          max: Math.max(...groupNodes.map(n => n.uptime || 0)),
        };
      } else if (metric === 'storage') {
        const total = groupNodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
        const used = groupNodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
        trends[key] = {
          count: groupNodes.length,
          totalStorage: total,
          usedStorage: used,
          usagePercent: total > 0 ? (used / total) * 100 : 0,
        };
      } else if (metric === 'latency') {
        const withLatency = groupNodes.filter(n => n.latency !== undefined);
        if (withLatency.length > 0) {
          const avg = withLatency.reduce((sum, n) => sum + (n.latency || 0), 0) / withLatency.length;
          trends[key] = {
            count: groupNodes.length,
            withLatency: withLatency.length,
            average: avg,
            min: Math.min(...withLatency.map(n => n.latency || 0)),
            max: Math.max(...withLatency.map(n => n.latency || 0)),
          };
        }
      } else if (metric === 'cpu') {
        const withCPU = groupNodes.filter(n => n.cpuPercent !== undefined);
        if (withCPU.length > 0) {
          const avg = withCPU.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / withCPU.length;
          trends[key] = {
            count: groupNodes.length,
            withCPU: withCPU.length,
            average: avg,
            min: Math.min(...withCPU.map(n => n.cpuPercent || 0)),
            max: Math.max(...withCPU.map(n => n.cpuPercent || 0)),
          };
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        metric,
        groupBy,
        trends,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to calculate trends' },
      { status: 500 }
    );
  }
});

