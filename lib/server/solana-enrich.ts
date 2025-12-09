/**
 * Server-side Solana on-chain data enrichment
 * Fetches balance, validator info, and account creation data for nodes
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAllNodes } from './mongodb-nodes';

// Legacy helpers not implemented; keep stubs so build passes
async function updateNodeBalance(_pubkey: string, _balance: number | null) {
  return true;
}

async function updateNodeOnChainData(_pubkey: string, _data: any) {
  return true;
}

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const BATCH_SIZE = 50; // Process 50 nodes at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

/**
 * Fetch balance and on-chain data for a single node
 */
async function fetchNodeOnChainData(
  connection: Connection,
  publicKey: string
): Promise<{ 
  balance: number | null; 
  isValidator: boolean;
  accountCreatedAt?: Date;
  firstSeenSlot?: number;
  error?: string;
}> {
  try {
    const pubkey = new PublicKey(publicKey);
    
    // Fetch balance, vote accounts, and account info in parallel
    const [balance, voteAccounts, accountInfo] = await Promise.all([
      connection.getBalance(pubkey),
      connection.getVoteAccounts().catch(() => null),
      connection.getAccountInfo(pubkey).catch(() => null),
    ]);
    
    // Check if this node is a validator
    let isValidator = false;
    if (voteAccounts) {
      const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
      isValidator = allValidators.some(
        (v) => v.nodePubkey === publicKey || v.votePubkey === publicKey
      );
    }
    
    // Try to determine account creation time
    // This is approximate - we get the slot when the account was first funded
    let accountCreatedAt: Date | undefined;
    let firstSeenSlot: number | undefined;
    
    if (accountInfo) {
      // The account exists - try to get first transaction
      try {
        const signatures = await connection.getSignaturesForAddress(
          pubkey,
          { limit: 1000 }, // Get up to 1000 signatures to find the oldest
          'confirmed'
        );
        
        if (signatures.length > 0) {
          // The last signature in the array is the oldest
          const oldestSig = signatures[signatures.length - 1];
          firstSeenSlot = oldestSig.slot;
          
          // Estimate timestamp from slot (approximate)
          // Solana devnet: ~400ms per slot on average
          const currentSlot = await connection.getSlot();
          const slotsAgo = currentSlot - firstSeenSlot;
          const msAgo = slotsAgo * 400; // Approximate
          accountCreatedAt = new Date(Date.now() - msAgo);
        }
      } catch (sigError) {
        console.warn(`[Solana Enrich] Could not fetch signatures for ${publicKey}:`, sigError);
      }
    }
    
    return {
      balance: balance / 1e9, // Convert lamports to SOL
      isValidator,
      accountCreatedAt,
      firstSeenSlot,
    };
  } catch (error: any) {
    return {
      balance: null,
      isValidator: false,
      error: error.message,
    };
  }
}

/**
 * Enrich all nodes with Solana on-chain data
 */
export async function enrichNodesWithSolana(): Promise<{
  updated: number;
  skipped: number;
  failed: number;
  validators: number;
}> {
  try {
    const nodes = await getAllNodes();
    console.log(`[Solana Enrich] Processing ${nodes.length} nodes`);
    
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let validators = 0;
    
    // Process in batches
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      console.log(
        `[Solana Enrich] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(nodes.length / BATCH_SIZE)}`
      );
      
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          // Skip if no public key
          if (!node.publicKey && !node.pubkey) {
            return { node, status: 'skipped' };
          }
          
          const pubkey = node.publicKey || node.pubkey;
          if (!pubkey) {
            return { node, status: 'skipped' };
          }
          
          try {
            const onChainData = await fetchNodeOnChainData(connection, pubkey);
            
            if (onChainData.balance !== null) {
              // Update on-chain data in database
              const success = await updateNodeOnChainData(pubkey, {
                balance: onChainData.balance,
                isValidator: onChainData.isValidator,
                accountCreatedAt: onChainData.accountCreatedAt,
                firstSeenSlot: onChainData.firstSeenSlot,
              });
              
              if (onChainData.isValidator) {
                validators++;
              }
              
              return {
                node,
                status: success ? 'updated' : 'failed',
                balance: onChainData.balance,
                isValidator: onChainData.isValidator,
              };
            } else {
              return { node, status: 'failed', error: onChainData.error };
            }
          } catch (error: any) {
            return { node, status: 'failed', error: error.message };
          }
        })
      );
      
      // Count results
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value as any;
          if (data.status === 'updated') {
            updated++;
          } else if (data.status === 'skipped') {
            skipped++;
          } else if (data.status === 'failed') {
            failed++;
          }
        } else {
          failed++;
        }
      });
      
      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < nodes.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    console.log(
      `[Solana Enrich] Complete: ${updated} updated, ${skipped} skipped, ${failed} failed, ${validators} validators`
    );
    return { updated, skipped, failed, validators };
  } catch (error) {
    console.error('[Solana Enrich] Error:', error);
    return { updated: 0, skipped: 0, failed: 0, validators: 0 };
  }
}
