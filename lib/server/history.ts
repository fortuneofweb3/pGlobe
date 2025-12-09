/**
 * Historical Data Storage
 * Stores node data over time for trend analysis
 */

import { PNode } from '../types/pnode';
import fs from 'fs/promises';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), '.data', 'history');
const MAX_DAYS_TO_KEEP = 30; // Keep 30 days of history
const MAX_POINTS_PER_DAY = 288; // One point every 5 minutes = 288 per day

interface HistoricalDataPoint {
  timestamp: number;
  avgUptime: number;
  onlineCount: number;
  totalNodes: number;
  nodes?: PNode[]; // Optional: store full node data
}

interface NodeHistory {
  nodeId: string;
  dataPoints: Array<{
    timestamp: number;
    status?: string;
    uptime?: number;
    reputation?: number;
    credits?: number;
    storageUsed?: number;
    storageCapacity?: number;
  }>;
}

/**
 * Ensure history directory exists
 */
async function ensureHistoryDir() {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create history directory:', error);
  }
}

/**
 * Get today's history file path
 */
function getTodayHistoryFile(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(HISTORY_DIR, `${today}.json`);
}

/**
 * Store a historical data point
 */
export async function storeHistoricalData(
  nodes: PNode[],
  includeFullNodes = false
): Promise<void> {
  try {
    await ensureHistoryDir();
    
    const timestamp = Date.now();
    const avgUptime = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodes.length
      : 0;
    const onlineCount = nodes.filter((n) => n.status === 'online').length;

    const dataPoint: HistoricalDataPoint = {
      timestamp,
      avgUptime,
      onlineCount,
      totalNodes: nodes.length,
    };

    // Optionally include full node data (larger file size)
    if (includeFullNodes) {
      dataPoint.nodes = nodes.map((n) => ({ ...n }));
    }

    const filePath = getTodayHistoryFile();
    
    // Read existing data for today
    let todayData: HistoricalDataPoint[] = [];
    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      todayData = JSON.parse(existing);
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Add new data point
    todayData.push(dataPoint);

    // Limit points per day
    if (todayData.length > MAX_POINTS_PER_DAY) {
      todayData = todayData.slice(-MAX_POINTS_PER_DAY);
    }

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(todayData, null, 2));

    // Clean up old files
    await cleanupOldHistory();
  } catch (error) {
    console.error('Failed to store historical data:', error);
    // Don't throw - historical data is nice to have but not critical
  }
}

/**
 * Get historical data for a date range
 */
export async function getHistoricalData(
  startDate?: Date,
  endDate?: Date,
  includeFullNodes = false
): Promise<HistoricalDataPoint[]> {
  try {
    await ensureHistoryDir();

    const start = startDate || new Date(Date.now() - MAX_DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const allData: HistoricalDataPoint[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const filePath = path.join(HISTORY_DIR, `${dateStr}.json`);

      try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        const dayData: HistoricalDataPoint[] = JSON.parse(fileData);
        
        // Filter out full node data if not requested (to reduce size)
        const filteredData = includeFullNodes
          ? dayData
          : dayData.map(({ nodes, ...rest }) => rest);

        allData.push(...filteredData);
      } catch {
        // File doesn't exist for this date, skip
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by timestamp
    return allData.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to get historical data:', error);
    return [];
  }
}

/**
 * Get historical data for a specific node
 */
export async function getNodeHistory(
  nodeId: string,
  days = 7
): Promise<NodeHistory | null> {
  try {
    await ensureHistoryDir();

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const historicalData = await getHistoricalData(startDate, new Date(), true);

    const nodeDataPoints: NodeHistory['dataPoints'] = [];

    for (const point of historicalData) {
      if (point.nodes) {
        const node = point.nodes.find((n) => n.id === nodeId);
        if (node) {
          nodeDataPoints.push({
            timestamp: point.timestamp,
            status: node.status,
            uptime: node.uptime,
            reputation: node.reputation,
            credits: node.credits,
            storageUsed: node.storageUsed,
            storageCapacity: node.storageCapacity,
          });
        }
      }
    }

    if (nodeDataPoints.length === 0) {
      return null;
    }

    return {
      nodeId,
      dataPoints: nodeDataPoints.sort((a, b) => a.timestamp - b.timestamp),
    };
  } catch (error) {
    console.error('Failed to get node history:', error);
    return null;
  }
}

/**
 * Clean up old history files
 */
async function cleanupOldHistory(): Promise<void> {
  try {
    const files = await fs.readdir(HISTORY_DIR);
    const cutoffDate = new Date(Date.now() - MAX_DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const dateStr = file.replace('.json', '');
        if (dateStr < cutoffStr) {
          await fs.unlink(path.join(HISTORY_DIR, file));
          console.log(`Deleted old history file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old history:', error);
  }
}

/**
 * Get summary statistics from historical data
 */
export async function getHistoricalSummary(): Promise<{
  totalDataPoints: number;
  dateRange: { start: number; end: number };
  avgNodesOverTime: number;
  avgUptimeOverTime: number;
}> {
  try {
    const data = await getHistoricalData();
    
    if (data.length === 0) {
      return {
        totalDataPoints: 0,
        dateRange: { start: Date.now(), end: Date.now() },
        avgNodesOverTime: 0,
        avgUptimeOverTime: 0,
      };
    }

    const timestamps = data.map((d) => d.timestamp);
    const avgNodes = data.reduce((sum, d) => sum + d.totalNodes, 0) / data.length;
    const avgUptime = data.reduce((sum, d) => sum + d.avgUptime, 0) / data.length;

    return {
      totalDataPoints: data.length,
      dateRange: {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps),
      },
      avgNodesOverTime: avgNodes,
      avgUptimeOverTime: avgUptime,
    };
  } catch (error) {
    console.error('Failed to get historical summary:', error);
    return {
      totalDataPoints: 0,
      dateRange: { start: Date.now(), end: Date.now() },
      avgNodesOverTime: 0,
      avgUptimeOverTime: 0,
    };
  }
}

