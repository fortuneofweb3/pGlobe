/**
 * In-memory cache for Solana on-chain balance data
 * Batch fetches balances from Solana RPC to minimize requests
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (balances can change)

interface ValidatorInfo {
  votePubkey: string;
  activatedStake: number;
  commission: number;
}

export interface BalanceData {
  balance: number; // in SOL
  isValidator: boolean;
  validatorInfo?: ValidatorInfo;
  isRegistered: boolean;
  managerPDA?: string;
  xandStake?: number;
  eraBoost?: number;
  eraLabel?: string;
}

interface CachedBalance {
  data: BalanceData;
  timestamp: number;
}

// In-memory cache: publicKey -> { data, timestamp }
const balanceCache = new Map<string, CachedBalance>();

/**
 * Fetch balance for a single public key
 */
export async function fetchBalanceForPubkey(
  publicKey: string,
  connection?: Connection
): Promise<BalanceData | null> {
  // Check cache first
  const cached = balanceCache.get(publicKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const conn = connection || new Connection(DEVNET_RPC, 'confirmed');

    // Use the comprehensive enrichment function from solana-pnodes
    const { enrichPNodeWithOnChainData } = await import('./solana-pnodes');
    const onChainData = await enrichPNodeWithOnChainData(publicKey, conn);

    if (onChainData.error) {
      console.warn(`[Balance Cache] Enrichment error for ${publicKey}:`, onChainData.error);
    }

    const balanceData: BalanceData = {
      balance: onChainData.balance || 0,
      isValidator: !!onChainData.isValidator,
      validatorInfo: onChainData.validatorInfo ? {
        votePubkey: (onChainData.validatorInfo as any).votePubkey || '',
        activatedStake: (onChainData.validatorInfo as any).activatedStake || 0,
        commission: (onChainData.validatorInfo as any).commission || 0,
      } : undefined,
      isRegistered: !!onChainData.isRegistered,
      managerPDA: onChainData.managerPDA,
      xandStake: onChainData.xandStake,
      eraBoost: onChainData.eraBoost,
      eraLabel: onChainData.eraLabel,
    };

    // Cache the result
    balanceCache.set(publicKey, {
      data: balanceData,
      timestamp: Date.now(),
    });

    return balanceData;
  } catch (err) {
    const error = err as Error;
    console.warn(`[Balance Cache] Failed to fetch balance for ${publicKey}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch balances for multiple public keys
 */
export async function batchFetchBalances(
  publicKeys: string[]
): Promise<Map<string, BalanceData>> {
  const results = new Map<string, BalanceData>();
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log(`[Balance Cache] Fetching balances for ${publicKeys.length} pubkeys...`);

  // Process in sequence for now to avoid complexity, but could be batched further
  for (const pk of publicKeys) {
    const data = await fetchBalanceForPubkey(pk, connection);
    if (data) {
      results.set(pk, data);
    }
  }

  return results;
}

/**
 * Clear the balance cache (useful for testing or forcing refresh)
 */
export function clearBalanceCache(): void {
  balanceCache.clear();
  console.log('[Balance Cache] Cache cleared');
}

/**
 * Get cache stats
 */
export function getBalanceCacheStats() {
  return {
    size: balanceCache.size,
    entries: Array.from(balanceCache.entries()).map(([key, value]) => ({
      publicKey: key,
      balance: value.data.balance,
      isValidator: value.data.isValidator,
      isRegistered: value.data.isRegistered,
      managerPDA: value.data.managerPDA,
      cachedAt: new Date(value.timestamp).toISOString(),
      age: Date.now() - value.timestamp,
    })),
  };
}
