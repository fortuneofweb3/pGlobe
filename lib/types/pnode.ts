/**
 * Shared Types for Xandeum pNodes
 * These types are used by both frontend and backend
 */

export interface PNodePeer {
  address: string;
  pubkey?: string;
  version?: string;
  last_seen?: string;
  last_seen_timestamp?: number;
}

export interface PNode {
  id: string;
  address: string;
  publicKey: string;
  pubkey?: string; // Alternative field name (added in Pod v0.5.1+)
  version?: string;
  
  // From get-stats (pRPC)
  uptime?: number; // Uptime in seconds (from stats.uptime)
  uptimePercent?: number; // Calculated uptime percentage
  status?: 'online' | 'offline' | 'syncing';
  cpuPercent?: number; // CPU usage percentage (from stats.cpu_percent)
  ramUsed?: number; // RAM used in bytes (from stats.ram_used)
  ramTotal?: number; // Total RAM in bytes (from stats.ram_total)
  packetsReceived?: number; // Packets received per second (from stats.packets_received)
  packetsSent?: number; // Packets sent per second (from stats.packets_sent)
  activeStreams?: number; // Active network streams (from stats.active_streams)
  storageCapacity?: number; // Total storage capacity in bytes (from metadata.total_bytes)
  storageUsed?: number; // Storage used in bytes (from file_size)
  storageCommitted?: number; // Storage committed in bytes (from get-pods-with-stats v0.7.0+)
  storageUsagePercent?: number; // Storage usage percentage (from get-pods-with-stats v0.7.0+)
  totalPages?: number; // Total pages (from metadata.total_pages)
  isPublic?: boolean; // Whether pRPC is publicly accessible (from get-pods-with-stats v0.7.0+)
  rpcPort?: number; // RPC port number (from get-pods-with-stats v0.7.0+)
  dataOperationsHandled?: number; // Data operations handled (from stats.data_operations_handled)
  
  // From get-pods (pRPC)
  lastSeen?: number; // Last seen timestamp in milliseconds
  peers?: PNodePeer[]; // Peers this node knows about (from get-pods)
  peerCount?: number; // Total number of peers
  
  // External data (not from pRPC)
  location?: string; // Location string (from IP geolocation)
  locationData?: {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
    countryCode?: string;
  };
  latency?: number; // Latency in ms (from ping test) - primary latency from server region
  latencyByRegion?: Record<string, number>; // Latency measurements from different regions { 'us-east': 50, 'eu-west': 120, ... }
  balance?: number; // SOL balance (from Solana on-chain)
  credits?: number; // Credits (from on-chain or heartbeat system, NOT from get-stats)
  isRegistered?: boolean; // Is node registered on-chain? (balance > 0)
  managerPDA?: string; // Manager PDA address (from on-chain)
  
  // On-chain account tracking (from Solana blockchain)
  accountCreatedAt?: Date; // When the Solana account was created (approximate, from first transaction)
  firstSeenSlot?: number; // First slot where account was seen (from oldest transaction signature)
  
  // Gossip tracking
  seenInGossip?: boolean; // true if node was returned by gossip in the last cycle, false if not (offline)
  
  // Error tracking
  _statsError?: string;
  _explanation?: any;
  [key: string]: any; // Allow additional fields
}

export interface PNodeGossipResponse {
  nodes: PNode[];
  timestamp: number;
  totalNodes: number;
}

