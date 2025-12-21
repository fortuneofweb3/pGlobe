/**
 * Public API v1: Network health history
 * GET /api/v1/network/health/history?period=24h|7d|30d
 * Returns historical network health scores over time
 */

import { NextResponse } from 'next/server';
import { getHistoricalSnapshots } from '@/lib/server/mongodb-history';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';

    // Calculate time range based on period
    const now = Date.now();
    let startTime: number;

    switch (period) {
      case '1h':
        startTime = now - (1 * 60 * 60 * 1000);
        break;
      case '6h':
        startTime = now - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000); // Default to 24h
    }

    console.log(`[NetworkHealthHistory] Fetching health history for period: ${period}`);

    // Fetch historical snapshots
    const snapshots = await getHistoricalSnapshots(startTime, now, 1000);

    if (snapshots.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period,
          dataPoints: 0,
          health: [],
          summary: {
            current: 0,
            average: 0,
            min: 0,
            max: 0,
            trend: 'stable',
          },
        },
      });
    }

    // Extract network health data points
    const healthData = snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      interval: snapshot.interval,
      overall: snapshot.networkHealthScore || 0,
      availability: snapshot.networkHealthAvailability || 0,
      versionHealth: snapshot.networkHealthVersion || 0,
      distribution: snapshot.networkHealthDistribution || 0,
      totalNodes: snapshot.totalNodes,
      onlineNodes: snapshot.onlineNodes,
      offlineNodes: snapshot.offlineNodes,
      syncingNodes: snapshot.syncingNodes,
    }));

    // Calculate summary stats
    const healthScores = healthData.map(d => d.overall);
    const current = healthScores[healthScores.length - 1] || 0;
    const average = healthScores.reduce((sum, val) => sum + val, 0) / healthScores.length;
    const min = Math.min(...healthScores);
    const max = Math.max(...healthScores);

    // Determine trend (compare first half vs second half)
    const midpoint = Math.floor(healthScores.length / 2);
    const firstHalf = healthScores.slice(0, midpoint);
    const secondHalf = healthScores.slice(midpoint);
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;

    let trend: 'improving' | 'declining' | 'stable';
    if (diff > 2) {
      trend = 'improving';
    } else if (diff < -2) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return NextResponse.json({
      success: true,
      data: {
        period,
        dataPoints: healthData.length,
        health: healthData,
        summary: {
          current: Math.round(current * 10) / 10,
          average: Math.round(average * 10) / 10,
          min: Math.round(min * 10) / 10,
          max: Math.round(max * 10) / 10,
          trend,
          changePercent: Math.round((diff / firstAvg) * 1000) / 10, // Change percentage
        },
      },
    });
  } catch (error: any) {
    console.error('[NetworkHealthHistory] ❌ Failed to fetch health history:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch network health history',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
