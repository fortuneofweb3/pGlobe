/**
 * pRPC Client for Xandeum pNodes
 * 
 * This client handles communication with Xandeum pNode RPC endpoints.
 * Based on the Xandeum documentation at xandeum.network
 */

export interface PNode {
  id: string;
  address: string;
  publicKey: string;
  version?: string;
  uptime?: number;
  status?: 'online' | 'offline' | 'syncing';
  storageCapacity?: number;
  storageUsed?: number;
  lastSeen?: number;
  location?: string;
  latency?: number;
  reputation?: number;
  [key: string]: any; // Allow additional fields
}

export interface PNodeGossipResponse {
  nodes: PNode[];
  timestamp: number;
  totalNodes: number;
}

/**
 * Fetch all pNodes from gossip
 * Tries multiple endpoint patterns to find the correct pRPC endpoint
 * @param rpcEndpoint - Optional custom pRPC endpoint URL
 * @returns Promise with pNode data
 */
export async function fetchPNodesFromGossip(
  rpcEndpoint?: string
): Promise<PNode[]> {
  // List of potential pRPC endpoints to try
  const endpoints = rpcEndpoint 
    ? [rpcEndpoint]
    : [
        // Try common pRPC endpoint patterns
        'https://prpc.xandeum.network',
        'https://prpc.xandeum.com',
        'https://apis.devnet.xandeum.com',
        'https://apis.mainnet.xandeum.com',
        'https://rpc.xandeum.org',
        // Direct pNode gossip endpoints
        'https://gossip.xandeum.network',
        'https://pnode.xandeum.network',
      ];

  // Try different API method patterns
  const methods = [
    'getGossipNodes',
    'getPNodes',
    'getNodes',
    'gossip.getNodes',
    'pnode.getGossip',
  ];

  // Try different endpoint path patterns
  const paths = [
    '/gossip/nodes',
    '/gossip',
    '/nodes',
    '/pnode/gossip',
    '/api/gossip/nodes',
    '/rpc',
    '', // Root endpoint
  ];

  for (const endpoint of endpoints) {
    for (const path of paths) {
      for (const method of methods) {
        try {
          const url = `${endpoint}${path}`;
          
          // Try POST with JSON-RPC format
          let response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: method,
              params: [],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            
            // Handle different response formats
            if (data.result) {
              const nodes = Array.isArray(data.result) 
                ? data.result 
                : data.result.nodes || [];
              if (nodes.length > 0) {
                console.log(`Successfully fetched pNodes from ${url} using method ${method}`);
                return nodes;
              }
            }
            
            if (Array.isArray(data) && data.length > 0) {
              console.log(`Successfully fetched pNodes from ${url}`);
              return data;
            }
          }

          // Try GET request as well
          if (path) {
            response = await fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
                console.log(`Successfully fetched pNodes from ${url} (GET)`);
                return data.nodes;
              }
              
              if (Array.isArray(data) && data.length > 0) {
                console.log(`Successfully fetched pNodes from ${url} (GET)`);
                return data;
              }
            }
          }
        } catch (error) {
          // Continue trying other endpoints
          continue;
        }
      }
    }
  }

  // If all endpoints fail, throw an error instead of returning mock data
  throw new Error(
    'Failed to fetch pNodes from any known pRPC endpoint. ' +
    'Please check Xandeum documentation for the correct pRPC endpoint or join their Discord: https://discord.gg/uqRSmmM5m'
  );
}

/**
 * Get detailed information about a specific pNode
 */
export async function getPNodeDetails(
  nodeId: string,
  rpcEndpoint: string = 'https://prpc.xandeum.network'
): Promise<PNode | null> {
  try {
    const response = await fetch(`${rpcEndpoint}/node/${nodeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getNodeInfo',
        params: [nodeId],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error('Error fetching pNode details:', error);
    return null;
  }
}

/**
 * Mock data for development and demonstration
 * Only used when explicitly requested (e.g., for testing UI)
 * In production, this should not be used - real pRPC endpoints must be configured
 */
export function getMockPNodes(): PNode[] {
  return [
    {
      id: '1',
      address: 'pnode1.xandeum.network',
      publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      version: '1.2.0',
      uptime: 99.8,
      status: 'online',
      storageCapacity: 1000000, // GB
      storageUsed: 450000,
      lastSeen: Date.now() - 5000,
      location: 'US-East',
      latency: 12,
      reputation: 95,
    },
    {
      id: '2',
      address: 'pnode2.xandeum.network',
      publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      version: '1.2.0',
      uptime: 98.5,
      status: 'online',
      storageCapacity: 2000000,
      storageUsed: 1200000,
      lastSeen: Date.now() - 10000,
      location: 'EU-West',
      latency: 25,
      reputation: 92,
    },
    {
      id: '3',
      address: 'pnode3.xandeum.network',
      publicKey: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
      version: '1.1.9',
      uptime: 95.2,
      status: 'syncing',
      storageCapacity: 500000,
      storageUsed: 200000,
      lastSeen: Date.now() - 30000,
      location: 'Asia-Pacific',
      latency: 45,
      reputation: 88,
    },
    {
      id: '4',
      address: 'pnode4.xandeum.network',
      publicKey: '3xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      version: '1.2.0',
      uptime: 99.9,
      status: 'online',
      storageCapacity: 1500000,
      storageUsed: 750000,
      lastSeen: Date.now() - 2000,
      location: 'US-West',
      latency: 18,
      reputation: 97,
    },
    {
      id: '5',
      address: 'pnode5.xandeum.network',
      publicKey: '8WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      version: '1.2.0',
      uptime: 97.8,
      status: 'online',
      storageCapacity: 800000,
      storageUsed: 400000,
      lastSeen: Date.now() - 15000,
      location: 'EU-East',
      latency: 30,
      reputation: 90,
    },
  ];
}

