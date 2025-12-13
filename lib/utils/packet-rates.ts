/**
 * Utilities for calculating packet transfer rates from historical data
 */

export interface HistoricalPacketData {
  timestamp: number;
  packetsReceived?: number;
  packetsSent?: number;
}

export interface PacketRates {
  rxRate: number; // packets per second
  txRate: number; // packets per second
  totalRate: number; // packets per second
  timeWindow: number; // seconds
}

/**
 * Calculate packet rates from historical data
 * Compares the latest snapshot with previous snapshots to determine rate
 */
export function calculatePacketRates(
  historicalData: HistoricalPacketData[],
  windowMinutes: number = 5
): PacketRates | null {
  if (historicalData.length < 2) {
    return null;
  }

  // Sort by timestamp (oldest first)
  const sorted = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];
  
  // Find the snapshot closest to the desired time window
  const targetTime = latest.timestamp - (windowMinutes * 60 * 1000);
  let previous = sorted[0];
  
  // Find the closest snapshot before the target time
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].timestamp <= targetTime) {
      previous = sorted[i];
      break;
    }
    // If we're getting close to the beginning, use this one
    if (i === 0 || sorted[i].timestamp < targetTime) {
      previous = sorted[i];
      break;
    }
  }

  const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // seconds
  
  if (timeDiff <= 0) {
    return null;
  }

  const rxDiff = (latest.packetsReceived || 0) - (previous.packetsReceived || 0);
  const txDiff = (latest.packetsSent || 0) - (previous.packetsSent || 0);
  
  const rxRate = rxDiff / timeDiff;
  const txRate = txDiff / timeDiff;
  const totalRate = rxRate + txRate;

  return {
    rxRate: Math.max(0, rxRate), // Ensure non-negative
    txRate: Math.max(0, txRate),
    totalRate: Math.max(0, totalRate),
    timeWindow: timeDiff,
  };
}

/**
 * Calculate average packet rate over multiple time windows
 */
export function calculateAveragePacketRate(
  historicalData: HistoricalPacketData[],
  numWindows: number = 5
): PacketRates | null {
  if (historicalData.length < numWindows + 1) {
    return calculatePacketRates(historicalData);
  }

  const sorted = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];
  
  // Calculate rates for multiple windows and average them
  const rates: PacketRates[] = [];
  const windowSize = Math.floor(sorted.length / (numWindows + 1));
  
  for (let i = 1; i <= numWindows; i++) {
    const idx = sorted.length - (i * windowSize) - 1;
    if (idx >= 0) {
      const previous = sorted[idx];
      const timeDiff = (latest.timestamp - previous.timestamp) / 1000;
      
      if (timeDiff > 0) {
        const rxDiff = (latest.packetsReceived || 0) - (previous.packetsReceived || 0);
        const txDiff = (latest.packetsSent || 0) - (previous.packetsSent || 0);
        
        rates.push({
          rxRate: Math.max(0, rxDiff / timeDiff),
          txRate: Math.max(0, txDiff / timeDiff),
          totalRate: Math.max(0, (rxDiff + txDiff) / timeDiff),
          timeWindow: timeDiff,
        });
      }
    }
  }

  if (rates.length === 0) {
    return null;
  }

  // Average the rates
  const avgRx = rates.reduce((sum, r) => sum + r.rxRate, 0) / rates.length;
  const avgTx = rates.reduce((sum, r) => sum + r.txRate, 0) / rates.length;
  const avgTotal = rates.reduce((sum, r) => sum + r.totalRate, 0) / rates.length;
  const avgWindow = rates.reduce((sum, r) => sum + r.timeWindow, 0) / rates.length;

  return {
    rxRate: avgRx,
    txRate: avgTx,
    totalRate: avgTotal,
    timeWindow: avgWindow,
  };
}

/**
 * Format packet rate for display
 */
export function formatPacketRate(rate: number): string {
  if (rate >= 1000000) {
    return `${(rate / 1000000).toFixed(2)}M/s`;
  }
  if (rate >= 1000) {
    return `${(rate / 1000).toFixed(2)}K/s`;
  }
  return `${rate.toFixed(2)}/s`;
}

