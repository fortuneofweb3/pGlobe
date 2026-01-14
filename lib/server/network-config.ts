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
  programId?: string; // Optional: Program ID for the network
  comingSoon?: boolean; // Optional: Indicates if the network is coming soon
}

export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    id: 'devnet',
    name: 'Xandeum Devnet',
    rpcUrl: 'https://api.devnet.xandeum.com:8899',
    type: 'devnet',
    description: 'Xandeum Devnet RPC',
    programId: '6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL',
    enabled: true,
    comingSoon: false,
  },
  {
    id: 'mainnet1',
    name: 'MainNet',
    rpcUrl: 'https://rpc3.pchednode.com/rpc',
    type: 'mainnet',
    description: 'Mainnet - Coming Soon',
    enabled: true, // Now active
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

