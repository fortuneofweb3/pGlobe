/**
 * SOL Balance utilities for fetching node balances
 */

import { PNode } from '../types/pnode';

/**
 * Fetch SOL balance for a node
 */
export async function fetchNodeBalance(node: PNode): Promise<number | null> {
  const pubkey = node.pubkey || node.publicKey;
  if (!pubkey) return null;

  try {
    const response = await fetch(`/api/balance?pubkey=${encodeURIComponent(pubkey)}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.balance || null;
  } catch (error) {
    console.error(`Failed to fetch balance for node ${node.id}:`, error);
    return null;
  }
}

/**
 * Format SOL balance for display
 */
export function formatBalance(balance: number | null | undefined): string {
  if (balance === null || balance === undefined) return 'N/A';
  
  // Show exactly 0 for zero balances
  if (balance === 0) return '0 ◎';
  
  // For non-zero balances, show appropriate decimal places
  if (balance < 0.001) {
    // Very small balances: show up to 9 decimals (lamport precision)
    return `${balance.toFixed(9).replace(/\.?0+$/, '')} ◎`;
  } else if (balance < 1) {
    // Small balances: show up to 6 decimals
    return `${balance.toFixed(6).replace(/\.?0+$/, '')} ◎`;
  } else {
    // Normal balances: show up to 3 decimals
    return `${balance.toFixed(3).replace(/\.?0+$/, '')} ◎`;
  }
}

