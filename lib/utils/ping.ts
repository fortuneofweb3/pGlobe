/**
 * Ping/Latency utilities for testing node connectivity
 */

import { PNode } from '../types/pnode';

export interface PingResult {
  latency: number | null;
  status: 'online' | 'offline';
  error?: string;
}

/**
 * Test ping/latency to a node
 */
export async function pingNode(node: PNode): Promise<PingResult> {
  // Extract IP from address (format: "IP:PORT")
  const addressParts = node.address.split(':');
  const ip = addressParts[0];
  // Use node's rpcPort if available, otherwise try port from address, fallback to 6000
  const port = node.rpcPort?.toString() || addressParts[1] || '6000';

  if (!ip) {
    return {
      latency: null,
      status: 'offline',
      error: 'No IP address',
    };
  }

  try {
    const response = await fetch(`/api/ping?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`);
    if (!response.ok) {
      return {
        latency: null,
        status: 'offline',
        error: 'Ping test failed',
      };
    }

    const data = await response.json();
    return {
      latency: data.latency,
      status: data.status === 'online' ? 'online' : 'offline',
      error: data.error,
    };
  } catch (error) {
    console.error(`Failed to ping node ${node.id}:`, error);
    return {
      latency: null,
      status: 'offline',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get latency color class based on latency value
 */
export function getLatencyColor(latency: number | null): string {
  if (latency === null) return 'text-red-600';
  if (latency < 200) return 'text-green-600';
  if (latency < 400) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Format latency for display
 */
export function formatLatency(latency: number | null | undefined): string {
  if (latency === null || latency === undefined) return 'offline';
  return `${latency} ms`;
}

