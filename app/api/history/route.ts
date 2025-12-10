/**
 * Historical data endpoint - returns historical snapshots from MongoDB
 */

import { NextResponse } from 'next/server';
import { getHistoricalSnapshots, getDailyStats, getNodeHistory } from '@/lib/server/mongodb-history';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const summary = searchParams.get('summary') === 'true';
    const nodeId = searchParams.get('nodeId'); // Get history for specific node
    const days = parseInt(searchParams.get('days') || '30');
    const startTime = searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined;
    const endTime = searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined;
    
    // Get node-specific history
    if (nodeId) {
      const nodeHistory = await getNodeHistory(nodeId, startTime, endTime);
      return NextResponse.json({
        nodeId,
        data: nodeHistory,
        count: nodeHistory.length,
      });
    }
    
    // Get summary statistics
    if (summary) {
      const dailyStats = await getDailyStats(days);
      const snapshots = await getHistoricalSnapshots(
        startTime || (Date.now() - days * 24 * 60 * 60 * 1000),
        endTime
      );
      
      if (snapshots.length === 0) {
        return NextResponse.json({
          totalDataPoints: 0,
          dateRange: { start: Date.now(), end: Date.now() },
          avgNodesOverTime: 0,
          avgUptimeOverTime: 0,
          dailyStats: [],
        });
      }
      
      const avgNodes = snapshots.reduce((sum, s) => sum + s.totalNodes, 0) / snapshots.length;
      const avgUptime = snapshots.reduce((sum, s) => sum + s.avgUptimePercent, 0) / snapshots.length;
      
      return NextResponse.json({
        totalDataPoints: snapshots.length,
        dateRange: {
          start: snapshots[0]?.timestamp || Date.now(),
          end: snapshots[snapshots.length - 1]?.timestamp || Date.now(),
        },
        avgNodesOverTime: Math.round(avgNodes),
        avgUptimeOverTime: Math.round(avgUptime * 100) / 100,
        dailyStats,
      });
    }
    
    // Get full historical snapshots
    const snapshots = await getHistoricalSnapshots(startTime, endTime, 1000);
    
    return NextResponse.json({
      data: snapshots,
      count: snapshots.length,
      message: 'Historical data from MongoDB',
    });
  } catch (error: any) {
    console.error('[API History] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

