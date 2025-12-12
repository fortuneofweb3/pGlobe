/**
 * SERVER-ONLY: pRPC Client for Xandeum pNodes
 * 
 * PURE GOSSIP APPROACH - Fetches nodes from pRPC gossip network
 * 
 * Strategy (following domcrogan pattern - best pRPC pattern):
 * 1. Query known public pRPC endpoints with `get-pods` to discover nodes from gossip
 * 2. Merge and deduplicate all discovered nodes
 * 3. Query each discovered node for `get-stats` to enrich with detailed metrics
 * 
 * This module handles server-side communication with Xandeum pNode RPC endpoints.
 * DO NOT import this in client-side code (components, pages with 'use client').
 */

import { PNode } from '../types/pnode';
import * as http from 'http';

/**
 * Make HTTP request using Node.js native http module
 * (Next.js fetch has issues with HTTP endpoints)
 */
function httpPost(url: string, data: object, timeoutMs: number = 5000): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      };

      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(responseData);
            resolve(jsonData);
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.write(postData);
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Measure network latency using Time To First Byte (TTFB)
 * This measures actual network RTT, excluding server processing time
 * Returns latency in milliseconds, or null if measurement fails
 */
function measureLatencyTTFB(ip: string, port: number, timeoutMs: number = 2000): Promise<number | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let firstByteReceived = false;
    
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-version', // Lightweight call for latency measurement
      id: 1,
    });

    const options = {
      hostname: ip,
      port: port,
      path: '/rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: timeoutMs,
    };

    const req = http.request(options, (res) => {
      // Measure Time To First Byte (TTFB) - this is the actual network latency
      res.once('data', () => {
        if (!firstByteReceived) {
          firstByteReceived = true;
          const latency = Date.now() - startTime;
          // Consume and discard the rest of the response
          res.on('data', () => {});
          res.on('end', () => {
            req.destroy();
            resolve(latency);
          });
        }
      });

      res.on('error', () => {
        resolve(null);
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.setTimeout(timeoutMs);
    req.write(requestBody);
    req.end();
  });
}

/**
 * Measure latency to proxy RPC endpoint - what users actually use
 * Users connect to proxy RPC endpoints like rpc1.pchednode.com/rpc, not individual nodes
 * This measures latency as if we're a real client connecting through the proxy
 * Uses a lightweight pRPC call (get-version) for accurate measurement
 * Returns latency in milliseconds, or null if measurement fails
 */
function measureProxyRPCLatency(rpcUrl: string, timeoutMs: number = 2000): Promise<number | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let firstByteReceived = false;
    
    // Use pRPC's get-version method - lightweight and fast
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-version',
      id: 1,
      params: [],
    });

    try {
      const urlObj = new URL(rpcUrl);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: timeoutMs,
      };

      const req = httpModule.request(options, (res: any) => {
        // Measure Time To First Byte (TTFB) - this is what users experience
        res.once('data', () => {
          if (!firstByteReceived) {
            firstByteReceived = true;
            const latency = Date.now() - startTime;
            // Consume and discard the rest of the response
            res.on('data', () => {});
            res.on('end', () => {
              req.destroy();
              resolve(latency);
            });
          }
        });

        res.on('error', () => {
          resolve(null);
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.setTimeout(timeoutMs);
      req.write(requestBody);
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

// ============================================================================
// KNOWN PUBLIC pRPC ENDPOINTS
// These are pNodes with publicly accessible pRPC (port 6000)
// ============================================================================

const PUBLIC_PRPC_ENDPOINTS = [
  // Direct pRPC nodes (from official docs and competitor research)
  '173.212.203.145:6000',
  '173.212.220.65:6000',
  '161.97.97.41:6000',
  '192.190.136.36:6000',
  '192.190.136.37:6000',
  '192.190.136.38:6000',
  '192.190.136.28:6000',
  '192.190.136.29:6000',
  '207.244.255.1:6000',
  '173.249.59.66:6000',
  '173.249.54.191:6000',
];

// Extract just the IPs from public endpoints (for matching with gossip nodes)
const PUBLIC_PRPC_IPS = new Set(
  PUBLIC_PRPC_ENDPOINTS.map(endpoint => endpoint.split(':')[0])
);

// Proxy RPC servers (aggregate data from multiple pNodes)
export const PROXY_RPC_ENDPOINTS = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

// ============================================================================
// pRPC CALL HELPERS
// ============================================================================

/**
 * Make a pRPC JSON-RPC 2.0 call
 * Uses Node.js http/https modules for better compatibility (fetch fails on HTTP in Next.js)
 * Note: Most nodes have pRPC on localhost only, so failures are expected
 */
async function callPRPC(
  host: string,
  method: 'get-pods' | 'get-stats' | 'get-version' | 'get-pods-with-stats',
  timeout: number = 5000,
  silent: boolean = false // Don't log failures for enrichment calls
): Promise<any | null> {
  const url = host.startsWith('http') ? host : `http://${host}/rpc`;
  
  const payload = {
    jsonrpc: '2.0',
    method: method,
    id: 1,
    params: [],
  };

  // Use httpPost for HTTP endpoints (fetch doesn't work reliably in Next.js server)
  if (url.startsWith('http://')) {
    try {
      const response = await httpPost(url, payload, timeout);
      if (response && response.result) {
        return response.result;
      }
      // Check if response has error field
      if (response && response.error) {
        if (!silent) {
          console.log(`[pRPC] ${host} ${method} error:`, response.error);
        }
        return null;
      }
      // If response exists but no result, log for debugging (only for get-pods to avoid spam)
      if (response && method === 'get-pods' && !silent) {
        console.log(`[pRPC] ${host} ${method} returned response but no result field. Response keys: ${Object.keys(response).join(', ')}`);
      }
      return null;
    } catch (error: any) {
      if (!silent) {
        console.log(`[pRPC] ${host} ${method} failed:`, error.message);
      }
      return null;
    }
  }
  
  // For HTTPS, use fetch
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.error) {
        if (!silent) console.debug(`[pRPC] ${host} ${method} error:`, data.error);
        return null;
      }
      return data.result || null;
    } else {
      return null;
    }
  } catch (error: any) {
    // Silent fail - most nodes don't have public pRPC (localhost-only by default)
    // Only log if not in silent mode
    if (!silent) {
      console.debug(`[pRPC] ${host} ${method} failed:`, error.message);
    }
  }
  
  return null;
}

/**
 * Get unique key for deduplication
 * Priority: pubkey > IP address > id
 * This ensures nodes with pubkeys are properly identified even if IP changes
 */
function getNodeKey(node: PNode): string {
  // Use pubkey first (most reliable identifier)
  if (node.pubkey) return `pubkey:${node.pubkey}`;
  if (node.publicKey) return `pubkey:${node.publicKey}`;
  // Fallback to IP address if no pubkey
  const ip = node.address?.split(':')[0];
  if (ip) return `ip:${ip}`;
  // Last resort: use id
  return node.id || '';
}

/**
 * Get IP address from node (for IP-based deduplication)
 */
function getNodeIP(node: PNode): string | null {
  return node.address?.split(':')[0] || null;
}

/**
 * Validate if a pubkey is a valid Solana public key
 * Valid Solana pubkeys are base58 encoded and typically 32-44 characters
 */
function isValidPubkey(pubkey: string | null | undefined): boolean {
  if (!pubkey || typeof pubkey !== 'string') return false;
  
  // Remove whitespace
  const trimmed = pubkey.trim();
  if (!trimmed) return false;
  
  // Invalid patterns: too short, contains spaces, looks like an IP, or common invalid patterns
  if (trimmed.length < 32) return false; // Solana pubkeys are at least 32 chars
  if (trimmed.length > 44) return false; // Solana pubkeys are max 44 chars
  if (/\s/.test(trimmed)) return false; // No whitespace
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false; // Not an IP address
  if (/^pubkey\d+$/i.test(trimmed)) return false; // Invalid pattern like "pubkey10"
  if (/^[0-9]+$/.test(trimmed)) return false; // Not just numbers
  
  // Try to validate as base58 Solana pubkey using PublicKey constructor
  try {
    // Import PublicKey dynamically to avoid issues if @solana/web3.js isn't available
    const { PublicKey } = require('@solana/web3.js');
    new PublicKey(trimmed);
    return true;
  } catch {
    // If PublicKey validation fails, it's invalid
    return false;
  }
}

/**
 * Get RPC URL for a node, trying multiple ports if needed
 * Uses node.rpcPort if available, otherwise tries common ports
 * @param node - The node to get RPC URL for
 * @param portsToTry - Optional array of ports to try (defaults to [rpcPort, 6000, 9000])
 * @returns RPC URL string
 */
function getRpcUrlForNode(node: PNode, portsToTry?: number[]): string {
  const ip = getNodeIP(node);
  if (!ip) {
    // Fallback if no IP
    return 'http://127.0.0.1:6000/rpc';
  }

  // Default ports to try: node's rpcPort first, then 6000 (default), then 9000
  const defaultPorts = node.rpcPort ? [node.rpcPort, 6000, 9000] : [6000, 9000];
  const ports = portsToTry || defaultPorts;
  
  // Use the first port (preferred port)
  return `http://${ip}:${ports[0]}/rpc`;
}

/**
 * Try calling pRPC on multiple ports for a node
 * Returns the first successful result, or null if all fail
 */
async function callPRPCMultiPort(
  node: PNode,
  method: 'get-pods' | 'get-stats' | 'get-version' | 'get-pods-with-stats',
  timeout: number = 5000,
  silent: boolean = false
): Promise<any | null> {
  const ip = getNodeIP(node);
  if (!ip) return null;

  // Ports to try: node's rpcPort first, then 6000 (default), then 9000
  const portsToTry = node.rpcPort 
    ? [node.rpcPort, 6000, 9000] 
    : [6000, 9000];

  // Try each port sequentially
  for (const port of portsToTry) {
    const url = `http://${ip}:${port}/rpc`;
    const result = await callPRPC(url, method, timeout, silent);
    if (result !== null) {
      // Success! Update node's rpcPort if we found it
      if (!node.rpcPort && port !== 6000) {
        node.rpcPort = port;
      }
      return result;
    }
  }

  return null;
}

/**
 * Try to fetch pubkey for a node that doesn't have one
 * Attempts get-version or get-stats which may return pubkey
 */
async function fetchPubkeyForNode(node: PNode): Promise<string | null> {
  if (node.pubkey || node.publicKey) {
    return node.pubkey || node.publicKey || null;
  }

  if (!node.address) return null;

  try {
    // Try get-version first (lighter call, may include pubkey in some versions)
    // Use multi-port helper to try node's rpcPort, then 6000, then 9000
    const versionResult = await callPRPCMultiPort(node, 'get-version', 2000, true);
    if (versionResult?.pubkey) {
      return versionResult.pubkey;
    }

    // Try get-stats (may include pubkey in response)
    const statsResult = await callPRPCMultiPort(node, 'get-stats', 2000, true);
    if (statsResult?.pubkey) {
      return statsResult.pubkey;
    }
  } catch (error) {
    // Silent fail - most nodes won't respond
  }

  return null;
}

/**
 * Calculate node status based on last_seen_timestamp from gossip
 * If no last_seen_timestamp, status is offline
 */
function calculateStatus(lastSeenTimestamp: number | undefined): { status: 'online' | 'offline' | 'syncing'; lastSeen: number } {
  if (!lastSeenTimestamp) {
    // No last_seen_timestamp = offline
    return { status: 'offline', lastSeen: Date.now() };
  }

  // Handle timestamp in seconds vs milliseconds
  let lastSeen: number;
  if (lastSeenTimestamp > 1e12) {
    lastSeen = lastSeenTimestamp; // Already milliseconds
  } else if (lastSeenTimestamp > 1e9) {
    lastSeen = lastSeenTimestamp * 1000; // Convert seconds to ms
  } else {
    lastSeen = Date.now();
  }

  const timeSinceLastSeen = Date.now() - lastSeen;
  const fiveMinutes = 5 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  let status: 'online' | 'offline' | 'syncing';
  if (timeSinceLastSeen < fiveMinutes) {
    status = 'online';
  } else if (timeSinceLastSeen < oneHour) {
    status = 'syncing';
  } else {
    status = 'offline';
  }

  return { status, lastSeen };
}

// ============================================================================
// STEP 1: DISCOVER NODES FROM GOSSIP (get-pods or get-pods-with-stats)
// ============================================================================

/**
 * Fetch pods with stats from a single pRPC endpoint using v0.7.0+ API
 * This is more efficient than get-pods + get-stats for each node
 */
async function fetchPodsWithStatsFromEndpoint(endpoint: string): Promise<PNode[]> {
  // Use longer timeout for gossip queries (they can return thousands of nodes)
  const result = await callPRPC(endpoint, 'get-pods-with-stats', 30000, true);
  if (!result) {
    // Log why it failed (timeout, error, etc.)
    return [];
  }

  // Extract pods array from response - handle different response formats
  let pods: any[] = [];
  if (Array.isArray(result)) {
    pods = result;
  } else if (result.pods && Array.isArray(result.pods)) {
    pods = result.pods;
  } else if (result.nodes && Array.isArray(result.nodes)) {
    pods = result.nodes;
  } else if (result.result && Array.isArray(result.result)) {
    pods = result.result;
  } else if (result.result && result.result.pods && Array.isArray(result.result.pods)) {
    pods = result.result.pods;
  } else if (result.total_count !== undefined && result.total_count === 0) {
    // Explicitly empty result
    return [];
  }

  if (pods.length === 0) return [];

  // Debug: Log all fields in first pod to see what we might be missing
  if (pods.length > 0) {
    const firstPod = pods[0];
    const podKeys = Object.keys(firstPod);
    console.log(`[DEBUG] get-pods-with-stats fields: ${podKeys.join(', ')}`);
    console.log(`[DEBUG] Sample pod:`, JSON.stringify(firstPod, null, 2).substring(0, 500));
  }

  // Map to PNode format with stats included
  // Filter out nodes without valid pubkeys
  return pods
    .map((pod: any, index: number): PNode | null => {
    const address = pod.address || '';
    const pubkey = pod.pubkey || pod.publicKey || '';
      
      // Skip nodes without valid pubkeys
      if (!isValidPubkey(pubkey)) {
        console.log(`[pRPC] Skipping node with invalid pubkey: ${pubkey || 'missing'} (address: ${address})`);
        return null;
      }
      
    const { status, lastSeen } = calculateStatus(pod.last_seen_timestamp);

    const ip = address.split(':')[0] || '';
    const port = address.split(':')[1] || '9001';

    // Extract stats from v0.7.0+ response format
    // Handle both snake_case and camelCase field names
    const storageUsed = pod.storage_used ?? pod.storageUsed ?? undefined;
    const storageCommitted = pod.storage_committed ?? pod.storageCommitted ?? undefined;
    
    const enrichedNode: PNode = {
      id: address || pubkey || `unknown-${index}`,
      publicKey: pubkey,
      pubkey: pubkey,
      address: address,
      version: pod.version || '',
      status: status,
      lastSeen: lastSeen,
      // Stats from get-pods-with-stats (v0.7.0+)
      uptime: pod.uptime ?? pod.uptime_seconds ?? undefined,
      storageUsed: storageUsed,
      storageCommitted: storageCommitted,
      storageCapacity: storageCommitted ?? pod.storage_capacity ?? pod.storageCapacity ?? undefined, // Use storage_committed as capacity, fallback to storage_capacity
      storageUsagePercent: pod.storage_usage_percent ?? pod.storageUsagePercent ?? undefined,
      totalPages: pod.total_pages ?? pod.totalPages ?? undefined,
      dataOperationsHandled: pod.data_operations_handled ?? pod.dataOperationsHandled ?? undefined,
      isPublic: pod.is_public ?? pod.isPublic ?? undefined,
      rpcPort: pod.rpc_port ?? pod.rpcPort ?? undefined,
      peerCount: pod.peer_count ?? pod.peerCount ?? undefined,
      peers: pod.peers ? (Array.isArray(pod.peers) ? pod.peers : undefined) : undefined,
      _raw: pod,
      _source: 'gossip-with-stats',
    };

    return enrichedNode;
    })
    .filter((node): node is PNode => node !== null); // Remove null entries
}

/**
 * Fetch pods from a single pRPC endpoint
 */
async function fetchPodsFromEndpoint(endpoint: string): Promise<PNode[]> {
  // Use longer timeout for gossip queries (they can be slow)
  const result = await callPRPC(endpoint, 'get-pods', 20000, true);
  if (!result) {
    // Log when we get null result (timeout, error, etc.)
    return [];
  }

  // Extract pods array from response - handle different response formats
  let pods: any[] = [];
  if (Array.isArray(result)) {
    pods = result;
  } else if (result.pods && Array.isArray(result.pods)) {
    pods = result.pods;
  } else if (result.nodes && Array.isArray(result.nodes)) {
    pods = result.nodes;
  } else if (result.result && Array.isArray(result.result)) {
    pods = result.result;
  } else if (result.result && result.result.pods && Array.isArray(result.result.pods)) {
    pods = result.result.pods;
  } else if (result.total_count !== undefined) {
    // Response has total_count but no pods array - might be empty
    if (result.total_count === 0) {
      // Log when endpoint returns empty result (might be normal if node has no peers)
      return [];
    }
    // If total_count > 0 but no pods array, log for debugging
    console.log(`[fetchPodsFromEndpoint] ${endpoint}: total_count=${result.total_count} but no pods array found. Result keys: ${Object.keys(result).join(', ')}`);
  } else {
    // Log when we can't parse the response format
    console.log(`[fetchPodsFromEndpoint] ${endpoint}: Could not parse response. Result type: ${typeof result}, keys: ${result && typeof result === 'object' ? Object.keys(result).join(', ') : 'N/A'}`);
  }

  if (pods.length === 0) return [];

  // Debug: Log all fields in first pod to see what we might be missing
  if (pods.length > 0) {
    const firstPod = pods[0];
    const podKeys = Object.keys(firstPod);
    console.log(`[DEBUG] get-pods fields: ${podKeys.join(', ')}`);
    console.log(`[DEBUG] Sample pod:`, JSON.stringify(firstPod, null, 2).substring(0, 500));
  }

  // Map to PNode format
  // Filter out nodes without valid pubkeys
  return pods
    .map((pod: any, index: number): PNode | null => {
    const address = pod.address || '';
    const pubkey = pod.pubkey || pod.publicKey || '';
      
      // Skip nodes without valid pubkeys
      if (!isValidPubkey(pubkey)) {
        console.log(`[pRPC] Skipping node with invalid pubkey: ${pubkey || 'missing'} (address: ${address})`);
        return null;
      }
      
    const { status, lastSeen } = calculateStatus(pod.last_seen_timestamp);

    const ip = address.split(':')[0] || '';
    const port = address.split(':')[1] || '9001';

    return {
      id: address || pubkey || `unknown-${index}`, // Use address (IP:PORT) as ID, fallback to pubkey
      publicKey: pubkey,
      pubkey: pubkey,
      address: address,
      version: pod.version || '',
      status: status,
      lastSeen: lastSeen,
      _raw: pod,
      _source: 'gossip',
    };
    })
    .filter((node): node is PNode => node !== null); // Remove null entries
}

/**
 * Discover all pods from gossip network by querying multiple endpoints
 * Always queries both get-pods-with-stats (v0.7.0+) AND get-pods (all versions) to get complete coverage
 */
async function discoverPodsFromGossip(): Promise<Map<string, PNode>> {
  const nodesMap = new Map<string, PNode>();

  // Use get-pods for discovery (works with ALL versions including 0.5.1, 0.6.0, 0.7.0+)
  // get-pods-with-stats is v0.7.0+ only, so it won't help us find older versions
  console.log(`[DiscoverPods] Querying ${PROXY_RPC_ENDPOINTS.length} proxy RPC endpoints with get-pods (all versions)...`);
  const proxyResults = await Promise.allSettled(
    PROXY_RPC_ENDPOINTS.map(async (endpoint) => {
      try {
        return await fetchPodsFromEndpoint(endpoint);
      } catch (error: any) {
        console.log(`  ❌ ${endpoint} (get-pods): Exception - ${error.message}`);
        return [];
      }
    })
  );

  let basicNodesCount = 0;
  let basicVersions = new Set<string>();
  let workingProxies = 0;
  // Add nodes from get-pods (all versions, including older ones)
  for (let i = 0; i < proxyResults.length; i++) {
    const endpoint = PROXY_RPC_ENDPOINTS[i];
    const result = proxyResults[i];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      workingProxies++;
      const endpointVersions = new Set<string>();
      for (const node of result.value) {
        const key = getNodeKey(node);
        if (key) {
          // Check for duplicates by pubkey and IP
          const existingNode = nodesMap.get(key);
          if (!existingNode) {
            // New node - add it
          nodesMap.set(key, node);
            basicNodesCount++;
            if (node.version) {
              basicVersions.add(node.version);
              endpointVersions.add(node.version);
        }
          } else {
            // Duplicate key - keep the one with more data
            const existingDataCount = Object.values(existingNode).filter(v => v !== undefined && v !== null).length;
            const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
            if (newNodeDataCount > existingDataCount) {
              nodesMap.set(key, node);
    }
  }
        }
      }
      console.log(`  ✅ ${endpoint}: ${result.value.length} nodes (versions: ${Array.from(endpointVersions).join(', ') || 'none'})`);
    } else if (result.status === 'rejected') {
      console.log(`  ❌ ${endpoint} (get-pods): Failed - ${result.reason?.message || 'error'}`);
    } else {
      console.log(`  ⚠️  ${endpoint} (get-pods): 0 nodes returned`);
    }
  }

  console.log(`[DiscoverPods] Proxy: ${basicNodesCount} from get-pods (versions: ${Array.from(basicVersions).join(', ') || 'none'})`);
  console.log(`[DiscoverPods] ${workingProxies}/${PROXY_RPC_ENDPOINTS.length} proxy endpoints working`);

  // Use get-pods for discovery (works with ALL versions including 0.5.1, 0.6.0, 0.7.0+)
  // get-pods-with-stats is v0.7.0+ only, so it won't help us find older versions
  console.log(`[DiscoverPods] Querying ${PUBLIC_PRPC_ENDPOINTS.length} direct pRPC endpoints with get-pods (all versions)...`);
  const directResults = await Promise.allSettled(
    PUBLIC_PRPC_ENDPOINTS.map(async (ip) => {
      try {
        return await fetchPodsFromEndpoint(`http://${ip}/rpc`);
      } catch (error: any) {
        console.log(`  ❌ ${ip} (get-pods): Exception - ${error.message}`);
        return [];
      }
    })
  );

  let directBasicCount = 0;
  let directBasicVersions = new Set<string>();
  let workingEndpoints = 0;
  // Add nodes from get-pods (all versions, including older ones)
  for (let i = 0; i < directResults.length; i++) {
    const endpoint = PUBLIC_PRPC_ENDPOINTS[i];
    const result = directResults[i];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      workingEndpoints++;
      const endpointVersions = new Set<string>();
      for (const node of result.value) {
        const key = getNodeKey(node);
        if (key) {
          // Check for duplicates by pubkey and IP
          const existingNode = nodesMap.get(key);
          if (!existingNode) {
            // New node - add it
          nodesMap.set(key, node);
            directBasicCount++;
            if (node.version) {
              directBasicVersions.add(node.version);
              endpointVersions.add(node.version);
            }
          } else {
            // Duplicate key - keep the one with more data
            const existingDataCount = Object.values(existingNode).filter(v => v !== undefined && v !== null).length;
            const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
            if (newNodeDataCount > existingDataCount) {
              nodesMap.set(key, node);
            }
          }
        }
      }
      console.log(`  ✅ ${endpoint}: ${result.value.length} nodes (versions: ${Array.from(endpointVersions).join(', ') || 'none'})`);
    } else if (result.status === 'rejected') {
      console.log(`  ❌ ${endpoint}: Failed (${result.reason?.message || 'error'})`);
    } else {
      console.log(`  ⚠️  ${endpoint}: 0 nodes returned`);
    }
  }

  console.log(`[DiscoverPods] Direct: ${directBasicCount} from get-pods (versions: ${Array.from(directBasicVersions).join(', ') || 'none'})`);
  console.log(`[DiscoverPods] ${workingEndpoints}/${PUBLIC_PRPC_ENDPOINTS.length} direct endpoints working, ${nodesMap.size} total nodes so far`);

  // STEP 3: Query ALL discovered nodes for their peers (MULTI-ROUND recursive discovery)
  // This is critical for finding older versions (0.5.1, 0.6.0) that might not be in main gossip
  // Each node's get-pods returns its own view of the network, which may include different nodes
  // Do multiple rounds to discover nodes that are only known by specific peers
  const queriedIPs = new Set<string>(PUBLIC_PRPC_ENDPOINTS.map(ep => ep.split(':')[0])); // Track which IPs we've queried
  
  const MAX_ROUNDS = 3; // Do up to 3 rounds of recursive discovery
  const BATCH_SIZE = 20;
  
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Get all discovered nodes that we haven't queried yet
    const allDiscoveredNodes = Array.from(nodesMap.values());
    const nodesToQuery = allDiscoveredNodes.filter(node => {
      const ip = node.address?.split(':')[0];
      return ip && !queriedIPs.has(ip);
    });

    if (nodesToQuery.length === 0) {
      console.log(`[DiscoverPods] Round ${round}: No new nodes to query, stopping recursive discovery`);
      break;
  }

    console.log(`[DiscoverPods] Round ${round}/${MAX_ROUNDS}: Querying ${nodesToQuery.length} discovered nodes for their peers...`);
    
    let totalNewFromNodeGossip = 0;
    const allNodeGossipVersions = new Set<string>();
    let successfulQueries = 0;
    
    for (let i = 0; i < nodesToQuery.length; i += BATCH_SIZE) {
      const batch = nodesToQuery.slice(i, i + BATCH_SIZE);
      
      const nodeGossipResults = await Promise.allSettled(
        batch.map(async (node) => {
          const ip = node.address?.split(':')[0];
          if (!ip) return [];
          queriedIPs.add(ip);
          
          // Try multiple ports: node's rpcPort first, then 6000, then 9000
          const portsToTry = node.rpcPort ? [node.rpcPort, 6000, 9000] : [6000, 9000];
          
          for (const port of portsToTry) {
            const rpcUrl = `http://${ip}:${port}/rpc`;
          
          // Try get-pods-with-stats first (v0.7.0+) for more complete data
          // If that fails, fallback to get-pods (all versions)
          try {
            const statsResult = await fetchPodsWithStatsFromEndpoint(rpcUrl);
            if (statsResult.length > 0) {
                // Success! Update node's rpcPort if we found it
                if (!node.rpcPort && port !== 6000) {
                  node.rpcPort = port;
                }
              return statsResult; // Got data from get-pods-with-stats
            }
          } catch (e) {
            // Fall through to get-pods
          }
          
          // Fallback to get-pods (works with all versions)
            try {
              const podsResult = await fetchPodsFromEndpoint(rpcUrl);
              if (podsResult.length > 0) {
                // Success! Update node's rpcPort if we found it
                if (!node.rpcPort && port !== 6000) {
                  node.rpcPort = port;
                }
                return podsResult;
              }
            } catch (e) {
              // Try next port
              continue;
            }
          }
          
          // All ports failed
          return [];
        })
      );

      for (const result of nodeGossipResults) {
        if (result.status === 'fulfilled') {
          const nodes = result.value;
          if (nodes.length > 0) {
            successfulQueries++;
            const ip = nodes[0]?.address?.split(':')[0] || 'unknown';
            const versions = new Set(nodes.map(n => n.version).filter(Boolean));
            if (round === 1 || versions.size > 0) { // Only log first round or if we found versions
              console.log(`  ✅ ${ip}: ${nodes.length} peers found (versions: ${Array.from(versions).join(', ') || 'none'})`);
            }
          }
          for (const node of nodes) {
            const key = getNodeKey(node);
            if (key) {
              // Check for duplicates by pubkey and IP
              const existingNode = nodesMap.get(key);
              if (!existingNode) {
                // New node - add it
                nodesMap.set(key, node);
                totalNewFromNodeGossip++;
                if (node.version) allNodeGossipVersions.add(node.version);
              } else {
                // Duplicate key - keep the one with more data
                const existingDataCount = Object.values(existingNode).filter(v => v !== undefined && v !== null).length;
                const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
                if (newNodeDataCount > existingDataCount) {
                  nodesMap.set(key, node);
                }
              }
            }
          }
        }
      }
      
      if (i % (BATCH_SIZE * 5) === 0 || i + BATCH_SIZE >= nodesToQuery.length) {
        console.log(`[DiscoverPods] Round ${round}: Queried ${Math.min(i + BATCH_SIZE, nodesToQuery.length)}/${nodesToQuery.length} nodes (${successfulQueries} successful), found ${totalNewFromNodeGossip} new nodes...`);
      }
    }
    
    if (totalNewFromNodeGossip > 0) {
      console.log(`[DiscoverPods] Round ${round}: ${totalNewFromNodeGossip} new nodes (versions: ${Array.from(allNodeGossipVersions).join(', ') || 'none'})`);
    } else {
      console.log(`[DiscoverPods] Round ${round}: ${successfulQueries}/${nodesToQuery.length} queries successful, but found 0 new nodes - stopping recursive discovery`);
      break; // No new nodes found, stop recursion
    }
  }
  
  // Count all unique versions found
  const allVersions = new Set<string>();
  for (const node of nodesMap.values()) {
    if (node.version) allVersions.add(node.version);
  }

  console.log(`[DiscoverPods] Total: ${nodesMap.size} unique nodes. All versions found: ${Array.from(allVersions).sort().join(', ') || 'none'}`);
  return nodesMap;
}

// ============================================================================
// STEP 2: ENRICH NODES WITH STATS (get-stats)
// ============================================================================

/**
 * Fetch stats for a single node
 * Note: Most will fail because pRPC is localhost-only by default
 * Exported for use in background refresh to re-enrich nodes with null values
 */
export async function fetchNodeStats(node: PNode): Promise<PNode> {
  if (!node.address) return node;

  const ip = node.address.split(':')[0];
  if (!ip) return node;

  // Use multi-port helper to try node's rpcPort, then 6000, then 9000
  // Fetch stats and version in parallel (silent mode - failures are expected)
  // Use shorter timeouts for faster enrichment (most nodes won't respond anyway)
  
  // Measure latency as if we're a real client using the node for data transfer
  // Applications connect through proxy RPC endpoints (rpc1.pchednode.com/rpc, etc.) for data operations
  // 
  // MULTI-REGION APPROACH:
  // Option 1: Measure from multiple regions using Cloudflare Workers (if configured)
  // Option 2: Measure from server location only (current fallback)
  //
  let latency: number | null = null;
  let latencyByRegion: Record<string, number> | undefined = undefined;
  let versionResult: any | null = null;
  let latencyMethod: 'multi-region' | 'proxy' | 'direct-prpc' | 'fallback-prpc' | null = null;
  
  // Multi-region latency is now measured in batch before calling fetchNodeStats
  // If node already has latencyByRegion from batch measurement, use it
  if (node.latencyByRegion && Object.keys(node.latencyByRegion).length > 0) {
    latencyByRegion = node.latencyByRegion;
    latency = node.latency ?? null; // Already set from batch measurement
    latencyMethod = 'multi-region';
    console.log(`[Latency] ${ip}: Using pre-measured multi-region latency from ${Object.keys(latencyByRegion).length} regions, best: ${latency}ms`);
  }
  
  // Fallback: Measure from server location only
  if (latency === null) {
    const proxyEndpoints = PROXY_RPC_ENDPOINTS;
    const proxyLatencies: Array<{ endpoint: string; latency: number }> = [];
    
    for (const endpoint of proxyEndpoints) {
      const proxyLatency = await measureProxyRPCLatency(endpoint, 2000);
      if (proxyLatency !== null) {
        proxyLatencies.push({ endpoint, latency: proxyLatency });
      }
    }
    
    // Use the minimum latency from proxy endpoints (best case scenario)
    if (proxyLatencies.length > 0) {
      const bestProxy = proxyLatencies.reduce((best, current) => 
        current.latency < best.latency ? current : best
      );
      latency = bestProxy.latency;
      latencyMethod = 'proxy';
      console.log(`[Latency] ${ip}: Proxy RPC latency = ${latency}ms (from ${bestProxy.endpoint}, tried ${proxyLatencies.length} endpoints)`);
    } else {
    // Fallback: Try direct pRPC endpoint (port 6000/9000) if proxy measurement failed
    // This gives us network latency to the specific node, though users don't connect directly
    if (ip) {
      const portsToTry = node.rpcPort ? [node.rpcPort, 6000, 9000] : [6000, 9000];
      for (const port of portsToTry) {
        const measuredLatency = await measureLatencyTTFB(ip, port, 2000);
        if (measuredLatency !== null) {
          latency = measuredLatency;
          latencyMethod = 'direct-prpc';
          console.log(`[Latency] ${ip}: Direct pRPC latency = ${latency}ms (port ${port}, TTFB)`);
          break;
          }
        }
      }
    }
  }
  
  // Final fallback: if TTFB measurement failed, try regular pRPC call (includes processing time)
  // This also fetches version for us
  if (latency === null) {
    const latencyStartTime = Date.now();
    versionResult = await callPRPCMultiPort(node, 'get-version', 2000, true);
    latency = versionResult ? Date.now() - latencyStartTime : null;
    if (latency !== null) {
      latencyMethod = 'fallback-prpc';
      console.log(`[Latency] ${ip}: Fallback pRPC latency = ${latency}ms (full request/response)`);
    } else {
      console.log(`[Latency] ${ip}: Failed to measure latency (all methods failed)`);
    }
  } else {
    // If we got latency from proxy or direct pRPC TTFB, still fetch version separately
    versionResult = await callPRPCMultiPort(node, 'get-version', 2000, true);
  }

  // Fetch stats in parallel (version already fetched above)
  const statsResult = await Promise.allSettled([
    callPRPCMultiPort(node, 'get-stats', 2000, true), // 2s timeout - fast fail
  ]).then(results => results[0]); // Get first (and only) result

  let enrichedNode = { ...node };

          // Only set latency if we got a successful response
          // If call failed/timeout, latency is null (offline/unreachable)
          enrichedNode.latency = latency ?? undefined;
          enrichedNode.latencyByRegion = latencyByRegion;

  // Process version (already fetched for latency measurement)
  if (versionResult?.version) {
    enrichedNode.version = versionResult.version;
  }

  // Process stats - API returns FLAT structure directly on result
  if (statsResult.status === 'fulfilled' && statsResult.value) {
    const stats = statsResult.value; // Flat structure, not nested!
    const fileSize = stats.file_size || 0;
    const uptimeSeconds = stats.uptime || 0;

    enrichedNode = {
      ...enrichedNode,
      // Uptime in seconds
      uptime: uptimeSeconds,
      uptimePercent: undefined, // API doesn't provide this
      // System metrics
      cpuPercent: stats.cpu_percent ?? undefined,
      ramUsed: stats.ram_used ?? undefined,
      ramTotal: stats.ram_total ?? undefined,
      // Network metrics - include ALL fields, even if 0
      packetsReceived: stats.packets_received ?? undefined,
      packetsSent: stats.packets_sent ?? undefined,
      activeStreams: stats.active_streams ?? undefined,
      // Storage: API only provides file_size (used), NOT capacity!
      // Preserve storageCapacity from get-pods-with-stats if it exists
      storageUsed: fileSize > 0 ? fileSize : (enrichedNode.storageUsed || undefined),
      storageCapacity: enrichedNode.storageCapacity || enrichedNode.storageCommitted || undefined, // Use committed as capacity if available
      totalPages: stats.total_pages ?? undefined,
      // Data operations
      dataOperationsHandled: stats.data_operations_handled ?? undefined,
      // Status: If we got stats, node is definitely online (override gossip status)
      // Otherwise keep the gossip status (online/offline/syncing)
      status: 'online',
    };

    const latencyInfo = latency !== null 
      ? `${latency}ms (${latencyMethod || 'unknown'})` 
      : 'null';
    console.log(`  ✅ Enriched ${ip}: uptime=${(uptimeSeconds / 86400).toFixed(1)}d, cpu=${stats.cpu_percent || 0}%, packets_rx=${stats.packets_received || 0}, packets_tx=${stats.packets_sent || 0}, latency=${latencyInfo}`);
  } else {
    // If stats call failed, preserve the gossip status (online/offline/syncing)
    // Don't override - keep whatever status gossip gave us
    // Only set offline if node has no status at all
    if (!enrichedNode.status) {
      enrichedNode.status = 'offline';
    }
    // Otherwise keep the existing status from gossip (preserves syncing!)
  }

  return enrichedNode;
}

/**
 * Enrich nodes with stats - try ALL nodes, not just public ones
 * Most will fail (localhost-only), but we try to get data for as many as possible
 * 
 * Note: If nodes were already fetched with get-pods-with-stats, they already have stats
 * and we only need to enrich nodes that don't have stats yet.
 */
async function enrichNodesWithStats(nodesMap: Map<string, PNode>): Promise<PNode[]> {
  // Strategy:
  // 1. First, enrich from known public endpoints (guaranteed to work)
  // 2. Then, try to fetch stats from ALL nodes (even if they have basic stats from get-pods-with-stats)
  //    because get-pods-with-stats doesn't include CPU, RAM, packets - those come from get-stats
  // 3. Also try to fetch pubkeys for nodes that don't have them
  
  const publicCount = await enrichFromKnownPublicEndpoints(nodesMap);
  
  // STEP 1: Try to fetch pubkeys for nodes without them
  const nodesWithoutPubkey = Array.from(nodesMap.values()).filter(node => !node.pubkey && !node.publicKey);
  if (nodesWithoutPubkey.length > 0) {
    console.log(`[EnrichStats] Attempting to fetch pubkeys for ${nodesWithoutPubkey.length} nodes without pubkey...`);
    const BATCH_SIZE = 10; // Smaller batch for pubkey fetching
    
    for (let i = 0; i < nodesWithoutPubkey.length; i += BATCH_SIZE) {
      const batch = nodesWithoutPubkey.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          const pubkey = await fetchPubkeyForNode(node);
          if (pubkey) {
            // Update node with pubkey
            const updatedNode = { ...node, pubkey, publicKey: pubkey };
            // Remove old key and add with new key (pubkey-based)
            const oldKey = getNodeKey(node);
            const newKey = getNodeKey(updatedNode);
            if (oldKey && newKey && oldKey !== newKey) {
              nodesMap.delete(oldKey);
              nodesMap.set(newKey, updatedNode);
            } else if (newKey) {
              nodesMap.set(newKey, updatedNode);
            }
            return pubkey;
          }
          return null;
        })
      );
      
      const fetchedPubkeys = results.filter(r => r.status === 'fulfilled' && r.value).length;
      if (fetchedPubkeys > 0) {
        console.log(`[EnrichStats] Fetched ${fetchedPubkeys} pubkeys (batch ${Math.floor(i / BATCH_SIZE) + 1})...`);
      }
    }
  }
  
  // STEP 2: Deduplicate by pubkey and IP address
  // Ensure no two nodes share the same pubkey or IP
  const pubkeyMap = new Map<string, PNode>();
  const ipMap = new Map<string, PNode>();
  const duplicatePubkeys: string[] = [];
  const duplicateIPs: string[] = [];
  
  for (const node of nodesMap.values()) {
    const pubkey = node.pubkey || node.publicKey;
    const ip = getNodeIP(node);
    
    // Check for duplicate pubkeys
    if (pubkey) {
      if (pubkeyMap.has(pubkey)) {
        const existing = pubkeyMap.get(pubkey)!;
        // Keep the node with more data (more fields filled)
        const existingDataCount = Object.values(existing).filter(v => v !== undefined && v !== null).length;
        const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
        
        if (newNodeDataCount > existingDataCount) {
          pubkeyMap.set(pubkey, node);
          duplicatePubkeys.push(pubkey);
        } else {
          duplicatePubkeys.push(pubkey);
        }
      } else {
        pubkeyMap.set(pubkey, node);
      }
    }
    
    // Check for duplicate IPs
    if (ip) {
      if (ipMap.has(ip)) {
        const existing = ipMap.get(ip)!;
        // Keep the node with more data
        const existingDataCount = Object.values(existing).filter(v => v !== undefined && v !== null).length;
        const newNodeDataCount = Object.values(node).filter(v => v !== undefined && v !== null).length;
        
        if (newNodeDataCount > existingDataCount) {
          ipMap.set(ip, node);
          duplicateIPs.push(ip);
        } else {
          duplicateIPs.push(ip);
        }
      } else {
        ipMap.set(ip, node);
      }
    }
  }
  
  // Rebuild nodesMap with deduplicated nodes
  const deduplicatedMap = new Map<string, PNode>();
  const seenPubkeys = new Set<string>();
  const seenIPs = new Set<string>();
  
  for (const node of nodesMap.values()) {
    const pubkey = node.pubkey || node.publicKey;
    const ip = getNodeIP(node);
    const key = getNodeKey(node);
    
    // Skip if we've already seen this pubkey or IP (keep first occurrence)
    if (pubkey && seenPubkeys.has(pubkey)) {
      continue;
    }
    if (ip && seenIPs.has(ip)) {
      continue;
    }
    
    if (pubkey) seenPubkeys.add(pubkey);
    if (ip) seenIPs.add(ip);
    
    if (key) {
      deduplicatedMap.set(key, node);
    }
  }
  
  if (duplicatePubkeys.length > 0 || duplicateIPs.length > 0) {
    console.log(`[EnrichStats] ⚠️  Found ${duplicatePubkeys.length} duplicate pubkeys, ${duplicateIPs.length} duplicate IPs - deduplicated`);
  }
  
  // Replace nodesMap with deduplicated version
  nodesMap.clear();
  for (const [key, node] of deduplicatedMap) {
    nodesMap.set(key, node);
  }
  
  // Now try to enrich ALL nodes (batch in parallel, fast timeouts)
  // Even if they have uptime from get-pods-with-stats, we still need CPU, RAM, packets from get-stats
  // ALWAYS measure latency for all nodes (it changes over time and indicates current connectivity)
  const allNodes = Array.from(nodesMap.values());
  const nodesToEnrich = allNodes.filter(node => {
    // Skip if already enriched from public endpoints (they were just enriched above)
    const ip = node.address?.split(':')[0];
    if (ip && PUBLIC_PRPC_IPS.has(ip)) {
      return false;
    }
    
    // Always enrich all other nodes to measure latency and get latest stats
    return true;
  });
  
  // STEP: Batch multi-region latency measurement (provider-agnostic)
  // Supports Deno Deploy, Cloudflare Workers, VPS endpoints, Vercel Edge Functions, or any HTTP endpoint
  // This measures ALL nodes at once from all regions (8 requests total instead of 1,272)
  const regionEndpoints: Record<string, string> | undefined = (() => {
    const urls: Record<string, string> = {};
    
    // Check for any environment variable matching region pattern
    // Priority: DENO_DEPLOY_* (recommended), then CF_WORKER_*, VPS_*, EDGE_FUNCTION_*, LATENCY_*, etc.
    const regionSuffixes = ['US_EAST', 'US_WEST', 'EU_WEST', 'EU_NORTH', 'ASIA_EAST', 'ASIA_NORTH', 'AFRICA_SOUTH', 'AFRICA_WEST'];
    const regionIds = ['us-east', 'us-west', 'eu-west', 'eu-north', 'asia-east', 'asia-north', 'africa-south', 'africa-west'];
    
    for (let i = 0; i < regionSuffixes.length; i++) {
      const suffix = regionSuffixes[i];
      const regionId = regionIds[i];
      
      // Check prefixes in priority order (AWS Lambda first - true region control, then others)
      const prefixes = ['AWS_LAMBDA_', 'VPS_', 'DENO_DEPLOY_', 'CF_WORKER_', 'EDGE_FUNCTION_', 'LATENCY_', 'MEASUREMENT_'];
      for (const prefix of prefixes) {
        const envVar = `${prefix}${suffix}`;
        const value = process.env[envVar];
        if (value) {
          urls[regionId] = value;
          break; // Use first match
        }
      }
    }
    
    return Object.keys(urls).length > 0 ? urls : undefined;
  })();
  
  let multiRegionLatencies: Record<string, Record<string, number>> = {}; // region -> nodeIP -> latency
  
  if (regionEndpoints && Object.keys(regionEndpoints).length > 0) {
    try {
      // Collect all node IPs
      const nodeIPs = nodesToEnrich
        .map(node => node.address?.split(':')[0])
        .filter((ip): ip is string => !!ip && ip !== 'localhost' && ip !== '127.0.0.1');
      
      if (nodeIPs.length > 0) {
        console.log(`[EnrichStats] Measuring latency from ${Object.keys(regionEndpoints).length} regions for ${nodeIPs.length} nodes (batched, provider-agnostic)...`);
        const { measureLatencyFromMultipleRegions } = await import('./multi-region-latency');
        multiRegionLatencies = await measureLatencyFromMultipleRegions(regionEndpoints, nodeIPs);
        
        // Apply multi-region latencies to nodes
        for (const node of nodesToEnrich) {
          const ip = node.address?.split(':')[0];
          if (ip && multiRegionLatencies) {
            const nodeLatencyByRegion: Record<string, number> = {};
            for (const [regionId, regionLatencies] of Object.entries(multiRegionLatencies)) {
              if (regionLatencies[ip] !== undefined) {
                nodeLatencyByRegion[regionId] = regionLatencies[ip];
              }
            }
            if (Object.keys(nodeLatencyByRegion).length > 0) {
              node.latencyByRegion = nodeLatencyByRegion;
              // Set primary latency as minimum from all regions
              node.latency = Math.min(...Object.values(nodeLatencyByRegion));
            }
          }
        }
        
        const nodesWithLatency = nodesToEnrich.filter(n => n.latencyByRegion && Object.keys(n.latencyByRegion).length > 0).length;
        console.log(`[EnrichStats] ✅ Multi-region latency measured for ${nodesWithLatency}/${nodeIPs.length} nodes`);
      }
    } catch (error: any) {
      console.warn(`[EnrichStats] Multi-region latency measurement failed:`, error.message);
    }
  }
  
  // Batch process in chunks to avoid overwhelming
  const BATCH_SIZE = 20;
  
  console.log(`[EnrichStats] Enriching ${nodesToEnrich.length} nodes with stats...`);
  
  for (let i = 0; i < nodesToEnrich.length; i += BATCH_SIZE) {
    const batch = nodesToEnrich.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(node => fetchNodeStats(node))
    );
    
    let successCount = 0;
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        const enrichedNode = (results[j] as PromiseFulfilledResult<PNode>).value;
        const key = getNodeKey(enrichedNode);
        if (key) {
          // Always update with latency (even if other stats didn't change)
          nodesMap.set(key, enrichedNode);
          if (enrichedNode.latency !== undefined) {
            successCount++;
        }
      }
      }
    }
    if (i % (BATCH_SIZE * 5) === 0) {
      console.log(`[EnrichStats] Processed ${Math.min(i + BATCH_SIZE, nodesToEnrich.length)}/${nodesToEnrich.length} nodes...`);
    }
  }
  
  console.log(`[EnrichStats] ✅ Enriched ${nodesToEnrich.length} nodes with latency measurements`);

  return Array.from(nodesMap.values());
}

/**
 * Fetch stats directly from known public pRPC endpoints
 * Uses Node.js http module directly (Next.js fetch has issues with HTTP)
 */
async function enrichFromKnownPublicEndpoints(nodesMap: Map<string, PNode>): Promise<number> {
  
  const results = await Promise.allSettled(
    PUBLIC_PRPC_ENDPOINTS.map(async (endpoint) => {
      const ip = endpoint.split(':')[0];
      // Extract port from endpoint if specified, otherwise default to 6000
      const endpointPort = endpoint.includes(':') ? parseInt(endpoint.split(':')[1]) : 6000;
      
      // Try multiple ports: endpoint port first, then 6000, then 9000
      const portsToTry = [endpointPort, 6000, 9000];
      let statsResponse: any = null;
      let versionResponse: any = null;
      let latency = 0;
      let workingPort = endpointPort;
      
      // Try each port until we get a successful response
      for (const port of portsToTry) {
        const rpcUrl = `http://${ip}:${port}/rpc`;
      
      // Use Node.js http module directly (not fetch - it fails on HTTP)
      const statsPayload = { jsonrpc: '2.0', id: 1, method: 'get-stats', params: [] };
      const versionPayload = { jsonrpc: '2.0', id: 2, method: 'get-version', params: [] };
      
      // Measure latency
      const startTime = Date.now();
        const [statsResp, versionResp] = await Promise.all([
        httpPost(rpcUrl, statsPayload, 5000),
        httpPost(rpcUrl, versionPayload, 3000),
      ]);
        const respLatency = Date.now() - startTime;
        
        // If we got a valid stats response, this port works
        if (statsResp?.result && typeof statsResp.result === 'object' && Object.keys(statsResp.result).length > 0) {
          statsResponse = statsResp;
          versionResponse = versionResp;
          latency = respLatency;
          workingPort = port;
          break; // Found working port, stop trying others
        }
      }
      
      // API returns FLAT structure directly on result (not nested in stats/metadata)
      const stats = statsResponse?.result || null;
      const version = versionResponse?.result?.version || null;
      
      if (stats && typeof stats === 'object' && Object.keys(stats).length > 0) {
        // Extract values from flat response
        const fileSize = stats.file_size || 0;           // Storage USED (bytes)
        const uptime = stats.uptime || 0;                // Uptime in SECONDS
        const ramTotal = stats.ram_total || 0;           // Total RAM (bytes)
        
        // NOTE: API does NOT return storage capacity!
        // total_bytes is something else entirely (very small value, ~95KB)
        // We can estimate capacity from ram_total as a rough proxy
        // Or leave capacity as undefined (honest)
        
        return { ip, stats, fileSize, uptime, version, latency, workingPort };
      }
      return null;
    })
  );

  let enrichedCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const { ip, stats, fileSize, uptime, version, latency, workingPort } = result.value;
      
      // Find existing node by IP or create new one
      let existingNode: PNode | undefined;
      for (const [key, node] of nodesMap) {
        if (node.address?.startsWith(ip + ':')) {
          existingNode = node;
          break;
        }
      }
      
      const enrichedNode: PNode = {
        id: existingNode?.id || `pnode-${ip}-6000`,
        publicKey: existingNode?.publicKey || '',
        pubkey: existingNode?.pubkey || '',
        address: existingNode?.address || `${ip}:9001`,
        version: version || existingNode?.version || '0.6.0',
        status: 'online',
        lastSeen: existingNode?.lastSeen || Date.now(),
        // Uptime in SECONDS (from flat API response)
        uptime: uptime,
      uptimePercent: undefined, // API doesn't provide this
        // System metrics (from flat API response) - include even if 0
        cpuPercent: stats.cpu_percent ?? undefined,
        ramUsed: stats.ram_used ?? undefined,
        ramTotal: stats.ram_total ?? undefined,
        // Storage: API only provides file_size (used), NOT capacity!
        // Preserve storageCapacity from get-pods-with-stats if it exists
        storageUsed: fileSize > 0 ? fileSize : null,
        storageCapacity: existingNode?.storageCapacity || existingNode?.storageCommitted || undefined, // Use committed as capacity if available
        // Network metrics - include ALL fields, even if 0
        packetsReceived: stats.packets_received ?? undefined,
        packetsSent: stats.packets_sent ?? undefined,
        activeStreams: stats.active_streams ?? undefined,
        totalPages: stats.total_pages ?? undefined,
        dataOperationsHandled: stats.data_operations_handled ?? undefined,
        latency: latency,
        rpcPort: workingPort || existingNode?.rpcPort || 6000, // Store the working port
        _source: 'public-prpc',
        _raw: existingNode?._raw,
      };

      const key = existingNode ? getNodeKey(existingNode) : enrichedNode.id;
      nodesMap.set(key, enrichedNode);
      enrichedCount++;
    }
  }

  return enrichedCount;
}

/**
 * REMOVED: enrichFromProxyServers
 * 
 * Proxy servers (rpc1/rpc2.pchednode.com) are used ONLY for gossip queries.
 * They are NOT actual pNodes and should NOT be displayed in the node list.
 * They are aggregators that help us discover real nodes from the gossip network.
 */

// ============================================================================
// MAIN EXPORT: fetchPNodesFromGossip
// ============================================================================

/**
 * Fetch all pNodes from gossip network (SERVER-ONLY)
 * 
 * Pure gossip approach:
 * 1. Query known public pRPC endpoints with get-pods
 * 2. Merge all discovered nodes (deduplicate by pubkey)
 * 3. Optionally query nodes for get-stats (most will fail - pRPC is localhost-only)
 * 
 * @param rpcEndpoint - Optional custom pRPC endpoint to try first
 * @param skipEnrichment - Skip get-stats enrichment (faster, most fail anyway)
 * @returns Promise with array of pNode data
 */
async function fetchPNodesFromGossip(
  rpcEndpoint?: string,
  skipEnrichment: boolean = false // Try enrichment by default - fast timeouts mean it won't take long
): Promise<PNode[]> {
  // If custom endpoint provided, try it first
  if (rpcEndpoint) {
    try {
      const nodes = await fetchPodsFromEndpoint(rpcEndpoint);
      if (nodes.length > 0) {
        // Create map
        const nodesMap = new Map<string, PNode>();
        for (const node of nodes) {
          const key = getNodeKey(node);
          if (key) nodesMap.set(key, node);
        }
        
        // Skip enrichment if requested
        if (skipEnrichment) {
          return Array.from(nodesMap.values());
        }
        
        return await enrichNodesWithStats(nodesMap);
      }
    } catch (error: any) {
      // Silent fail, fall through to all endpoints
    }
  }

  // Step 1: Discover all pods from gossip
  const nodesMap = await discoverPodsFromGossip();

  if (nodesMap.size === 0) {
    console.warn('⚠️ [pRPC] No nodes discovered from gossip. Network might be down.');
    return [];
  }

  // Step 2: Optionally enrich nodes with stats
  let finalNodes: PNode[];
  
  if (skipEnrichment) {
    finalNodes = Array.from(nodesMap.values());
  } else {
    finalNodes = await enrichNodesWithStats(nodesMap);
  }

  return finalNodes;
}

// ============================================================================
// MOCK DATA (for development)
// ============================================================================

function getMockPNodes(): PNode[] {
  return [
    {
      id: 'mock-1',
      address: '192.168.1.100:9001',
      publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      pubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      version: '0.6.0',
      uptime: 86400,
      uptimePercent: 99.8,
      status: 'online',
      storageCapacity: 1000000000000,
      storageUsed: 450000000000,
      lastSeen: Date.now() - 5000,
      location: 'US-East',
      latency: 12,
    },
    {
      id: 'mock-2',
      address: '192.168.1.101:9001',
      publicKey: '8yLYuh3DX98e08UYTEScC6kCireTB94U2V41spdhBtW',
      pubkey: '8yLYuh3DX98e08UYTEScC6kCireTB94U2V41spdhBtW',
      version: '0.6.0',
      uptime: 43200,
      uptimePercent: 95.5,
      status: 'online',
      storageCapacity: 500000000000,
      storageUsed: 250000000000,
      lastSeen: Date.now() - 60000,
      location: 'EU-West',
      latency: 45,
    },
  ];
}

// Export at the end
export { fetchPNodesFromGossip, getMockPNodes };
