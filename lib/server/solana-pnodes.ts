/**
 * Server-side Solana on-chain pNode fetching
 * Fetches pNode pubkeys from the Xandeum program index account
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
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
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com'; // For XAND tokens, NFTs, DAO stake
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');
const XANDEUM_REALM_ID = new PublicKey('5JpYydB2VFcxbPGr8xmpefmJw86GQELCk7cB132wRXCa');
const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNdXwpXH7sj');
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

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
 * This queries custom Xandeum Governance accounts on MAINNET
 */
async function fetchDAOStake(
  connection: Connection,
  ownerPubkey: PublicKey
): Promise<number> {
  try {
    // Search for custom stake accounts owned by Xandeum DAO
    // Discriminator at 0, Owner at 33, Stake (u64) at 66
    const accounts = await connection.getProgramAccounts(CUSTOM_GOV_PROGRAM, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
        { memcmp: { offset: 33, bytes: ownerPubkey.toBase58() } }
      ]
    });

    if (accounts.length > 0) {
      // If multiple accounts exist (one per pNode?), they seem to reflect the same total stake value
      // We'll take the max found
      let maxStake = 0;
      for (const acc of accounts) {
        const stake = Number(acc.account.data.readBigUInt64LE(66)) / 1e9;
        if (stake > maxStake) maxStake = stake;
      }

      if (maxStake > 0) {
        console.log(`[OnChain] Found custom DAO Stake for ${ownerPubkey.toBase58().slice(0, 8)}...: ${maxStake.toLocaleString()} XAND`);
      }
      return maxStake;
    }

    return 0;
  } catch (err) {
    console.warn('[OnChain] Failed to fetch custom DAO stake:', (err as Error).message);
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
  registrarWallet?: string;
  managerWallet?: string;
  registryPDA?: string;
  managerPDA?: string;
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
    let registrarWallet: string | undefined;
    let eraBoost = 1;
    let eraLabel = 'Standard';

    // Debug: Log registry fetch result
    if (registryAddress) {
      const regStatus = registryAccountResult.status;
      const regValue = regStatus === 'fulfilled' ? registryAccountResult.value : null;
      const regDataLen = regValue?.data?.length || 0;
      if (regDataLen > 0) {
        console.log(`[OnChain] ${pubkey.slice(0, 8)}...: Registry PDA found, data length=${regDataLen}`);
      }
    }

    if (registryAddress && registryAccountResult.status === 'fulfilled' && registryAccountResult.value) {
      registryPDA = registryAddress.toBase58();
      isRegistered = true;

      const data = registryAccountResult.value.data;

      // Extract wallets discovered via on-chain analysis:
      // Offset 8: Registrar Wallet (32 bytes)
      // Offset 40: Potential Era/Version (2 bytes)
      // Offset 42: Manager/Buyer Wallet (32 bytes) - Verified via Bx1aH... lookup
      if (data.length >= 40) {
        try {
          registrarWallet = new PublicKey(data.slice(8, 40)).toBase58();
          if (registrarWallet === '11111111111111111111111111111111') {
            registrarWallet = undefined;
          }
        } catch (e) { }
      }

      if (data.length >= 74) {
        try {
          managerWallet = new PublicKey(data.slice(42, 74)).toBase58();
          if (managerWallet === '11111111111111111111111111111111') {
            managerWallet = undefined;
          }
        } catch (e) { }
      }
    }

    if (managerAddress && managerAccountResult.status === 'fulfilled' && managerAccountResult.value) {
      managerPDA = managerAddress.toBase58();
      // Extract Manager Wallet (Authority) from first 32 bytes as fallback or verification
      // (The Registry PDA at offset 42 is the primary source for Buyer wallet now)
      if (!managerWallet && managerAccountResult.value.data.length >= 32) {
        try {
          const authorityBytes = managerAccountResult.value.data.slice(0, 32);
          managerWallet = new PublicKey(authorityBytes).toBase58();
        } catch (e) {
          console.warn(`[OnChain] Failed to parse authority from manager PDA for ${pubkey}`);
        }
      }
    }

    // Determine the "Owner" wallet for asset checks (XAND, NFTs, DAO stake)
    // These assets are on MAINNET, not devnet!
    // If we found the managerWallet (Buyer), use that for mainnet lookups
    const ownerForStake = managerWallet ? new PublicKey(managerWallet) : nodePubkey;

    // Create mainnet connection for asset lookups
    const mainnetConnection = new Connection(MAINNET_RPC, 'confirmed');

    // Fetch DAO stake for the Owner (on MAINNET)
    // This is the "XAND Stake" the user cares about (staked in DAO)
    const xandStake = await fetchDAOStake(mainnetConnection, ownerForStake);

    // Fetch NFT Multiplier (scan for Xandeum NFTs) - ON MAINNET
    let nftBoost = 1;
    const nftDetails: { name: string; multiplier: number; icon: string }[] = [];
    try {
      // Scan owner for NFTs on mainnet
      const parsedTokenAccounts = await mainnetConnection.getParsedTokenAccountsByOwner(ownerForStake, {
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

    // Assign Era Boost (moved from logic above for cleaner flow)
    // Extract Purchase Price for Era calculation at offset 40 in registry PDA
    if (registryAccountResult.status === 'fulfilled' && registryAccountResult.value) {
      const data = registryAccountResult.value.data;
      if (data.length >= 48) {
        try {
          const purchasePriceLamports = Number(data.readBigUInt64LE(40));
          const purchasePriceSOL = purchasePriceLamports / 1e9;

          // Map purchase price to Era
          // DeepSouth (16x), South (10x), Main (7x), Coal (3.5x), Central (2x), North (1.25x)
          if (purchasePriceSOL < 1.0) {
            eraBoost = 16; eraLabel = 'Deep South Era (1,500% boost)';
          } else if (purchasePriceSOL < 2.5) {
            eraBoost = 10; eraLabel = 'South Era (900% boost)';
          } else if (purchasePriceSOL < 3.5) {
            eraBoost = 7; eraLabel = 'Main Era (600% boost)';
          } else if (purchasePriceSOL < 4.5) {
            eraBoost = 3.5; eraLabel = 'Coal Era (250% boost)';
          } else if (purchasePriceSOL < 5.5) {
            eraBoost = 2; eraLabel = 'Central Era (100% boost)';
          } else {
            eraBoost = 1.25; eraLabel = 'North Era (25% boost)';
          }
        } catch (e) { }
      }
    }

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
      registrarWallet,
      validatorInfo,
      xandStake,
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
  registrarWallet?: string;
  validatorInfo?: unknown;
  xandStake?: number;
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
        managerWallet: onChainData.managerWallet,
        registrarWallet: onChainData.registrarWallet,
        validatorInfo: onChainData.validatorInfo,
        xandStake: onChainData.xandStake,
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

