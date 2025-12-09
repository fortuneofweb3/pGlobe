/**
 * Merge fresh gossip data with static DB data
 * Gossip provides real-time data, DB provides location/on-chain data
 */

import { PNode } from '@/lib/types/pnode';

/**
 * Merge nodes from different sources
 * @param gossipNodes - Fresh real-time data from gossip (status, uptime, CPU, etc.)
 * @param dbNodes - Static/semi-static data from DB (location, balance, etc.)
 * @returns Merged nodes with complete data
 */
export function mergeGossipWithDB(gossipNodes: PNode[], dbNodes: PNode[]): PNode[] {
  // Create map of DB nodes by publicKey for fast lookup
  const dbMap = new Map<string, PNode>();
  dbNodes.forEach(node => {
    const key = node.publicKey || node.pubkey;
    if (key) dbMap.set(key, node);
  });

  // Merge gossip data (real-time) with DB data (static)
  return gossipNodes.map(gossipNode => {
    const key = gossipNode.publicKey || gossipNode.pubkey;
    const dbNode = key ? dbMap.get(key) : undefined;

    if (dbNode) {
      // Merge: gossip provides real-time, DB provides static
      return {
        ...gossipNode, // Real-time data (status, uptime, CPU, etc.)
        // Override with static data from DB
        location: dbNode.location || gossipNode.location,
        locationData: dbNode.locationData || gossipNode.locationData,
        balance: dbNode.balance ?? gossipNode.balance,
        isValidator: dbNode.isValidator ?? gossipNode.isValidator,
        isRegistered: dbNode.isRegistered ?? gossipNode.isRegistered,
      };
    }

    // No DB data, just return gossip node
    return gossipNode;
  });
}

/**
 * Merge on-chain data with existing nodes
 * @param nodes - Existing nodes (gossip + DB)
 * @param onChainNodes - On-chain data (balance, validator status)
 * @returns Nodes with on-chain data merged
 */
export function mergeOnChainData(nodes: PNode[], onChainNodes: PNode[]): PNode[] {
  const onChainMap = new Map<string, PNode>();
  onChainNodes.forEach(node => {
    const key = node.publicKey || node.pubkey;
    if (key) onChainMap.set(key, node);
  });

  return nodes.map(node => {
    const key = node.publicKey || node.pubkey;
    const onChain = key ? onChainMap.get(key) : undefined;

    if (onChain) {
      return {
        ...node,
        balance: onChain.balance ?? node.balance,
        isValidator: onChain.isValidator ?? node.isValidator,
        isRegistered: onChain.isRegistered ?? node.isRegistered,
        registryPDA: (onChain as any).registryPDA ?? (node as any).registryPDA,
        managerPDA: (onChain as any).managerPDA ?? (node as any).managerPDA,
        validatorInfo: (onChain as any).validatorInfo ?? (node as any).validatorInfo,
      };
    }

    return node;
  });
}

