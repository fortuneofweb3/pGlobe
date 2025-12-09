/**
 * In-memory cache for Solana on-chain balance data
 * Batch fetches balances from Solana RPC to minimize requests
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (balances can change)
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

interface BalanceData {
  balance: number; // in SOL
  isValidator: boolean;
  validatorInfo?: any;
  isRegistered: boolean;
  managerPDA?: string;
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
    const pubkey = new PublicKey(publicKey);

    // Fetch balance, validator info, and manager PDA in parallel
    const [balance, voteAccounts, managerPDAResult] = await Promise.allSettled([
      conn.getBalance(pubkey),
      conn.getVoteAccounts(),
      (async () => {
        try {
          const [manager] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), pubkey.toBuffer()],
            DEVNET_PROGRAM
          );
          const managerInfo = await conn.getAccountInfo(manager);
          return {
            managerPDA: manager.toBase58(),
            exists: !!managerInfo,
          };
        } catch {
          return { managerPDA: undefined, exists: false };
        }
      })(),
    ]);

    // Check if validator
    let isValidator = false;
    let validatorInfo: any = undefined;

    if (voteAccounts.status === 'fulfilled' && voteAccounts.value) {
      const allVoteAccounts = [...voteAccounts.value.current, ...voteAccounts.value.delinquent];
      const nodeVoteAccount = allVoteAccounts.find(
        (v) => v.nodePubkey === publicKey || v.votePubkey === publicKey
      );

      if (nodeVoteAccount) {
        isValidator = true;
        validatorInfo = {
          votePubkey: nodeVoteAccount.votePubkey,
          activatedStake: Number(nodeVoteAccount.activatedStake || 0) / 1e9,
          commission: nodeVoteAccount.commission,
        };
      }
    }

    // Get manager PDA info
    const managerData = managerPDAResult.status === 'fulfilled' 
      ? managerPDAResult.value 
      : { managerPDA: undefined, exists: false };

    const balanceData: BalanceData = {
      balance: balance.status === 'fulfilled' ? balance.value / 1e9 : 0,
      isValidator,
      validatorInfo,
      isRegistered: managerData.exists,
      managerPDA: managerData.managerPDA,
    };

    // Cache the result
    balanceCache.set(publicKey, {
      data: balanceData,
      timestamp: Date.now(),
    });

    return balanceData;
  } catch (error: any) {
    console.warn(`[Balance Cache] Failed to fetch balance for ${publicKey}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch balances for multiple public keys
 * Uses Solana RPC batch requests for efficiency
 */
export async function batchFetchBalances(
  publicKeys: string[]
): Promise<Map<string, BalanceData>> {
  const results = new Map<string, BalanceData>();

  console.log(`[Balance Cache] Fetching balances for ${publicKeys.length} pubkeys...`);

  // Filter out invalid pubkeys
  const validPubkeys: string[] = [];
  for (const pk of publicKeys) {
    try {
      new PublicKey(pk);
      validPubkeys.push(pk);
    } catch {
      console.warn(`[Balance Cache] Invalid pubkey: ${pk}`);
    }
  }

  console.log(`[Balance Cache] ${validPubkeys.length}/${publicKeys.length} pubkeys are valid`);

  // Check cache first, only fetch uncached
  const uncachedPubkeys: string[] = [];
  for (const pk of validPubkeys) {
    const cached = balanceCache.get(pk);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(pk, cached.data);
    } else {
      uncachedPubkeys.push(pk);
    }
  }

  console.log(`[Balance Cache] ${results.size} from cache, ${uncachedPubkeys.length} need fetching`);

  if (uncachedPubkeys.length === 0) {
    return results;
  }

  try {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // Fetch vote accounts once (for validator checks)
    const voteAccounts = await connection.getVoteAccounts().catch(() => null);
    const allVoteAccounts = voteAccounts
      ? [...voteAccounts.current, ...voteAccounts.delinquent]
      : [];

    // Batch fetch balances - process in chunks of 100
    const BATCH_SIZE = 100;
    const batches = [];

    for (let i = 0; i < uncachedPubkeys.length; i += BATCH_SIZE) {
      batches.push(uncachedPubkeys.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Balance Cache] Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} pubkeys...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      console.log(`[Balance Cache] Batch ${batchNumber}/${batches.length}: Fetching ${batch.length} balances...`);

      // Fetch all balances in parallel
      const balancePromises = batch.map(async (pk) => {
        try {
          const pubkey = new PublicKey(pk);
          const [balance, managerResult] = await Promise.allSettled([
            connection.getBalance(pubkey),
            (async () => {
              try {
                const [manager] = PublicKey.findProgramAddressSync(
                  [Buffer.from('manager'), pubkey.toBuffer()],
                  DEVNET_PROGRAM
                );
                const managerInfo = await connection.getAccountInfo(manager);
                return {
                  managerPDA: manager.toBase58(),
                  exists: !!managerInfo,
                };
              } catch {
                return { managerPDA: undefined, exists: false };
              }
            })(),
          ]);

          // Check if validator
          const nodeVoteAccount = allVoteAccounts.find(
            (v) => v.nodePubkey === pk || v.votePubkey === pk
          );

          const managerData = managerResult.status === 'fulfilled'
            ? managerResult.value
            : { managerPDA: undefined, exists: false };

          const balanceData: BalanceData = {
            balance: balance.status === 'fulfilled' ? balance.value / 1e9 : 0,
            isValidator: !!nodeVoteAccount,
            validatorInfo: nodeVoteAccount
              ? {
                  votePubkey: nodeVoteAccount.votePubkey,
                  activatedStake: Number(nodeVoteAccount.activatedStake || 0) / 1e9,
                  commission: nodeVoteAccount.commission,
                }
              : undefined,
            isRegistered: managerData.exists,
            managerPDA: managerData.managerPDA,
          };

          // Cache it
          balanceCache.set(pk, {
            data: balanceData,
            timestamp: Date.now(),
          });

          return { pk, balanceData };
        } catch (error: any) {
          console.warn(`[Balance Cache] Failed for ${pk}:`, error.message);
          return { pk, balanceData: null };
        }
      });

      const batchResults = await Promise.all(balancePromises);

      let successCount = 0;
      batchResults.forEach(({ pk, balanceData }) => {
        if (balanceData) {
          results.set(pk, balanceData);
          successCount++;
        }
      });

      console.log(
        `[Balance Cache] Batch ${batchNumber}/${batches.length}: ${successCount}/${batch.length} succeeded, total: ${results.size}/${validPubkeys.length}`
      );

      // Small delay between batches to avoid overwhelming RPC
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (error: any) {
    console.error('[Balance Cache] Batch fetch error:', error.message);
  }

  console.log(`[Balance Cache] Completed: ${results.size}/${publicKeys.length} balances fetched`);
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

