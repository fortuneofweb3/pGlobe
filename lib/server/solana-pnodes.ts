/**
 * Server-side Solana on-chain pNode fetching
 * Fetches pNode pubkeys from the Xandeum program index account
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { PNode } from '../types/pnode';
import { XANDEUM_NFT_COLLECTIONS } from '../constants/nft';
import {
  getGovernanceAccounts,
  getRealm,
  getTokenOwnerRecord,
  GovernanceAccountType,
} from '@solana/spl-governance';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');
// Xandeum DAO Realm ID from user
const XANDEUM_REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
// SPL Governance Program ID (Devnet/Mainnet typically the same for standard deployments, but verifying for Xandeum)
// Assuming standard SPL Governance v2 or v3
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');

/**
 * Fetch all pNode pubkeys from the on-chain index account
 * This returns only the actual pNode pubkeys, not manager or registry accounts
 * 
 * @param rpcUrl - Optional custom RPC URL (defaults to devnet)
 * @returns Array of pNode public keys as strings
 */
export async function fetchPNodesFromOnChain(
  rpcUrl: string = DEVNET_RPC
): Promise<string[]> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log('[OnChain] Fetching pNode index account...');
    const accountInfo = await connection.getAccountInfo(INDEX_ACCOUNT);

    if (!accountInfo || !accountInfo.data) {
      console.warn('[OnChain] Index account not found or has no data');
      return [];
    }

    const accountData = accountInfo.data;
    const pubkeys: string[] = [];

    // Each pubkey is 32 bytes
    // Skip the default/empty pubkey (all zeros)
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    for (let i = 0; i < accountData.length; i += 32) {
      if (i + 32 > accountData.length) break;

      const pubkeyBytes = accountData.slice(i, i + 32);

      try {
        const pubkey = new PublicKey(pubkeyBytes);

        // Skip default/empty pubkeys
        if (!pubkey.equals(DEFAULT_PUBKEY)) {
          pubkeys.push(pubkey.toBase58());
        }
      } catch (e) {
        // Invalid pubkey bytes, skip
        continue;
      }
    }

    console.log(`[OnChain] Found ${pubkeys.length} pNodes from index account`);
    return pubkeys;
  } catch (err) {
    const error = err as Error;
    console.error('[OnChain] Error fetching pNodes:', error);
    throw new Error(`Failed to fetch pNodes from on-chain: ${error.message}`);
  }
}

/**
 * Get pNode count from on-chain index account
 */
export async function getOnChainPNodeCount(
  rpcUrl: string = DEVNET_RPC
): Promise<number> {
  const pubkeys = await fetchPNodesFromOnChain(rpcUrl);
  return pubkeys.length;
}

/**
 * Fetch staked XAND in the DAO for a given owner
 */
async function fetchDAOStake(
  connection: Connection,
  ownerPubkey: PublicKey
): Promise<number> {
  try {
    // Try to find the TokenOwnerRecord for this owner in the Xandeum Realm
    // The TokenOwnerRecord holds the amount of governing tokens (XAND) deposited

    // We need to derive the address of the TokenOwnerRecord
    // Seed: ['governance', realm, token_mint, token_owner]
    // However, spl-governance SDK provides helper

    // Since we don't have the SDK fully configured with all IDLs in this lightweight script, 
    // we'll try to fetch program accounts or use the address derivation if possible.
    // For robust 'get', we can use the helper if the package exports it cleanly.

    // Note: XAND_MINT is likely the governing token mint for the Realm

    try {
      const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
        GOVERNANCE_PROGRAM_ID,
        XANDEUM_REALM_ID,
        XAND_MINT,
        ownerPubkey
      );

      const tokenOwnerRecord = await getTokenOwnerRecord(connection, tokenOwnerRecordAddress);

      // governingTokenDepositAmount is a BN
      // We'll convert to number (careful with precision, but XAND decimals usually 9)
      const amount = Number(tokenOwnerRecord.account.governingTokenDepositAmount.toString());
      return amount / 1e9; // Assuming 9 decimals for XAND
    } catch (e) {
      // If record not found, stake is 0
      return 0;
    }

  } catch (err) {
    console.warn('[OnChain] Failed to fetch DAO stake:', err);
    return 0;
  }
}

// Helper to derive TokenOwnerRecord address manually if needed/simplified
async function getTokenOwnerRecordAddress(
  programId: PublicKey,
  realm: PublicKey,
  governingTokenMint: PublicKey,
  governingTokenOwner: PublicKey
): Promise<PublicKey> {
  const [tokenOwnerRecordAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('governance'),
      realm.toBuffer(),
      governingTokenMint.toBuffer(),
      governingTokenOwner.toBuffer(),
    ],
    programId
  );
  return tokenOwnerRecordAddress;
}

/**
 * Enrich a pNode with on-chain data (balance, validator status, registry/manager PDAs)
 */
export async function enrichPNodeWithOnChainData(
  pubkey: string,
  connection: Connection
): Promise<{
  balance?: number;
  isValidator?: boolean;
  isRegistered?: boolean;
  registryPDA?: string;
  managerPDA?: string;
  managerWallet?: string;
  validatorInfo?: unknown;
  xandStake?: number;
  daoStake?: number;
  nftBoost?: number;
  nftDetails?: { name: string; multiplier: number; icon: string }[];
  eraBoost?: number;
  eraLabel?: string;
  error?: string;
}> {
  try {
    const nodePubkey = new PublicKey(pubkey);

    // Pre-calculate PDAs to fetch them in parallel
    let registryAddress: PublicKey | undefined;
    try {
      [registryAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), nodePubkey.toBuffer()],
        DEVNET_PROGRAM
      );
    } catch { }

    let managerAddress: PublicKey | undefined;
    try {
      [managerAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), nodePubkey.toBuffer()],
        DEVNET_PROGRAM
      );
    } catch { }

    // Fetch all data in parallel
    const [
      balanceResult,
      voteAccountsResult,
      nodeAccountResult,
      registryAccountResult,
      managerAccountResult,
    ] = await Promise.allSettled([
      connection.getBalance(nodePubkey),
      connection.getVoteAccounts(),
      connection.getAccountInfo(nodePubkey),
      registryAddress ? connection.getAccountInfo(registryAddress) : Promise.resolve(null),
      managerAddress ? connection.getAccountInfo(managerAddress) : Promise.resolve(null),
    ]);

    // Process balance
    let balance: number | undefined;
    if (balanceResult.status === 'fulfilled') {
      balance = balanceResult.value / 1e9; // Convert lamports to SOL
    }

    // Check validator status
    let isValidator = false;
    let validatorInfo: unknown = undefined;
    if (voteAccountsResult.status === 'fulfilled') {
      const voteAccounts = voteAccountsResult.value;
      const allVoteAccounts = [...voteAccounts.current, ...voteAccounts.delinquent];
      const nodeVoteAccount = allVoteAccounts.find(
        v => v.nodePubkey === pubkey || v.votePubkey === pubkey
      );

      if (nodeVoteAccount) {
        isValidator = true;
        validatorInfo = {
          votePubkey: nodeVoteAccount.votePubkey,
          nodePubkey: nodeVoteAccount.nodePubkey,
          activatedStake: Number(nodeVoteAccount.activatedStake || 0),
          activatedStakeSOL: Number(nodeVoteAccount.activatedStake || 0) / 1e9,
          commission: nodeVoteAccount.commission,
          epochCredits: nodeVoteAccount.epochCredits,
          delinquent: voteAccounts.delinquent.some(v =>
            v.votePubkey === nodeVoteAccount.votePubkey || v.nodePubkey === nodeVoteAccount.nodePubkey
          ),
        };
      }
    }

    // Check registry and manager PDAs
    let isRegistered = false;
    let registryPDA: string | undefined;
    let managerPDA: string | undefined;
    let managerWallet: string | undefined;

    if (registryAddress && registryAccountResult.status === 'fulfilled' && registryAccountResult.value) {
      registryPDA = registryAddress.toBase58();
      isRegistered = true;
    }

    if (managerAddress && managerAccountResult.status === 'fulfilled' && managerAccountResult.value) {
      managerPDA = managerAddress.toBase58();
      // Extract Manager Wallet (Authority) from first 32 bytes
      if (managerAccountResult.value.data.length >= 32) {
        try {
          const authorityBytes = managerAccountResult.value.data.slice(0, 32);
          managerWallet = new PublicKey(authorityBytes).toBase58();
        } catch (e) {
          console.warn(`[OnChain] Failed to parse authority from manager PDA for ${pubkey}`);
        }
      }
    }

    // Determine the "Owner" wallet for DAO checks
    // If we found the managerWallet (Buyer), use that! 
    // Otherwise fallback to node pubkey (which is likely wrong for holding stake, but a fallback)
    const ownerForStake = managerWallet ? new PublicKey(managerWallet) : nodePubkey;

    // Fetch DAO stake for the Owner
    const daoStake = await fetchDAOStake(connection, ownerForStake);

    // Fetch XAND token balance (liquid stake)
    let xandStake = 0;
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(ownerForStake, {
        mint: XAND_MINT
      });

      if (tokenAccounts.value.length > 0) {
        // Sum balances of all XAND token accounts
        for (const account of tokenAccounts.value) {
          const accountInfo = await connection.getTokenAccountBalance(account.pubkey);
          xandStake += Number(accountInfo.value.uiAmount || 0);
        }
      }
    } catch (e) {
      // Failed to fetch token balance
    }

    // Fetch NFT Multiplier (scan for Xandeum NFTs)
    let nftBoost = 1;
    const nftDetails: { name: string; multiplier: number; icon: string }[] = [];
    try {
      // Scan owner for NFTs
      const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerForStake, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });

      for (const account of parsedTokenAccounts.value) {
        const info = account.account.data.parsed.info;
        const mint = info.mint;
        const amount = info.tokenAmount.uiAmount;

        if (amount >= 1) {
          // Check if this mint belongs to any of our official collections
          // This would normally check Metaplex Collection metadata
          const collectionMatch = XANDEUM_NFT_COLLECTIONS.find(c => c.collectionId === mint);
          if (collectionMatch) {
            nftBoost = Math.max(nftBoost, collectionMatch.multiplier);
            nftDetails.push({
              name: collectionMatch.name,
              multiplier: collectionMatch.multiplier,
              icon: collectionMatch.icon
            });
          }
        }
      }
    } catch (e) {
      // console.warn(`[OnChain] Failed to scan NFTs for ${pubkey}:`, e);
    }

    // Determine Era Boost (simplified estimation based on existence)
    // In a real scenario, this would check the registration timestamp or contract state
    // For now, we'll implement a stub that can be refined
    let eraBoost = 1;
    let eraLabel = 'Standard';

    if (isRegistered) {
      // Default to Standard for now unless we have more specific era data
    }

    return {
      balance,
      isValidator,
      isRegistered,
      registryPDA,
      managerPDA,
      managerWallet,
      validatorInfo,
      xandStake,
      daoStake,
      nftBoost,
      nftDetails,
      eraBoost,
      eraLabel,
    };
  } catch (err) {
    const error = err as Error;
    return {
      error: error.message || 'Failed to fetch on-chain data',
    };
  }
}

/**
 * Enrich multiple pNodes with on-chain data (batched for efficiency)
 */
export async function enrichPNodesWithOnChainData(
  pubkeys: string[],
  rpcUrl: string = DEVNET_RPC,
  batchSize: number = 20
): Promise<Map<string, {
  balance?: number;
  isValidator?: boolean;
  isRegistered?: boolean;
  registryPDA?: string;
  managerPDA?: string;
  managerWallet?: string;
  validatorInfo?: unknown;
  xandStake?: number;
  daoStake?: number;
  nftBoost?: number;
  nftDetails?: { name: string; multiplier: number; icon: string }[];
  eraBoost?: number;
  eraLabel?: string;
  error?: string;
}>> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const results = new Map();

  console.log(`[OnChain] Enriching ${pubkeys.length} pNodes with on-chain data (batch size: ${batchSize})`);

  // Process in batches to avoid rate limiting
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pubkeys.length / batchSize);

    console.log(`[OnChain] Processing batch ${batchNum}/${totalBatches} (${batch.length} nodes)`);

    const batchResults = await Promise.allSettled(
      batch.map(pubkey => enrichPNodeWithOnChainData(pubkey, connection))
    );

    batch.forEach((pubkey, idx) => {
      const result = batchResults[idx];
      if (result.status === 'fulfilled') {
        results.set(pubkey, result.value);
      } else {
        results.set(pubkey, { error: result.reason?.message || 'Unknown error' });
      }
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < pubkeys.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[OnChain] Enrichment complete: ${results.size} nodes processed`);
  return results;
}

/**
 * Convert on-chain pNode pubkeys to PNode objects with on-chain data
 */
export async function fetchAndEnrichOnChainPNodes(
  rpcUrl: string = DEVNET_RPC
): Promise<PNode[]> {
  try {
    // Fetch pNode pubkeys from index account
    const pubkeys = await fetchPNodesFromOnChain(rpcUrl);

    if (pubkeys.length === 0) {
      console.log('[OnChain] No pNodes found in index account');
      return [];
    }

    // Enrich with on-chain data
    const enrichmentData = await enrichPNodesWithOnChainData(pubkeys, rpcUrl);

    // Convert to PNode objects
    const pNodes: PNode[] = pubkeys.map(pubkey => {
      const onChainData = enrichmentData.get(pubkey) || {};

      const nftBoost = onChainData.nftBoost || 1;
      const eraBoost = onChainData.eraBoost || 1;

      return {
        id: pubkey,
        address: '', // No address from on-chain, will be merged with gossip data
        publicKey: pubkey,
        pubkey: pubkey,
        owner: onChainData.managerPDA || pubkey, // Use manager as owner/wallet ID
        balance: onChainData.balance,
        isValidator: onChainData.isValidator,
        isRegistered: onChainData.isRegistered,
        registryPDA: onChainData.registryPDA,
        managerPDA: onChainData.managerPDA,
        validatorInfo: onChainData.validatorInfo,
        xandStake: onChainData.xandStake,
        daoStake: onChainData.daoStake,
        nftBoost,
        nftDetails: onChainData.nftDetails,
        eraBoost,
        eraLabel: onChainData.eraLabel,
        // Calculate boost factor for single node: NFT * Era (multiplicative for individual node base)
        boostFactor: nftBoost * eraBoost,
        // Mark as from on-chain
        _source: 'onchain',
        _onChainError: onChainData.error,
      } as PNode;
    });

    console.log(`[OnChain] Created ${pNodes.length} PNode objects from on-chain data`);
    return pNodes;
  } catch (err) {
    const error = err as Error;
    console.error('[OnChain] Error fetching and enriching on-chain pNodes:', error);
    throw error;
  }
}

