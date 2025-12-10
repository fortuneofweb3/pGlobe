/**
 * Network Configuration
 * Defines available networks and their RPC endpoints
 * 
 * NOTE: As of December 2025, Xandeum only has DevNet (trynet) active.
 * Mainnet is not yet launched. Both devnet endpoints point to the same
 * gossip network - they're redundant for reliability.
 */

export interface NetworkConfig {
  id: string;
  name: string;
  rpcUrl: string;
  type: 'devnet' | 'mainnet';
  description?: string;
  enabled: boolean; // Whether this network is currently active
}

export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    id: 'devnet1',
    name: 'DevNet',
    rpcUrl: 'https://rpc1.pchednode.com/rpc',
    type: 'devnet',
    description: 'Primary devnet proxy RPC (trynet gossip)',
    enabled: true,
  },
  {
    id: 'devnet2',
    name: 'DevNet (Backup)',
    rpcUrl: 'https://rpc2.pchednode.com/rpc',
    type: 'devnet',
    description: 'Backup devnet proxy RPC (same gossip network)',
    enabled: true,
  },
  {
    id: 'mainnet1',
    name: 'MainNet',
    rpcUrl: 'https://rpc3.pchednode.com/rpc',
    type: 'mainnet',
    description: 'Mainnet - Coming Soon',
    enabled: false, // Not yet active
  },
];

export function getNetworkConfig(networkId: string): NetworkConfig | undefined {
  return NETWORK_CONFIGS.find(n => n.id === networkId);
}

export function getDefaultNetwork(): NetworkConfig {
  return NETWORK_CONFIGS[0]; // Default to devnet1
}

export function getEnabledNetworks(): NetworkConfig[] {
  return NETWORK_CONFIGS.filter(n => n.enabled);
}

