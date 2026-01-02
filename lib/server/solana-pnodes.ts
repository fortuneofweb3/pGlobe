/**
 * Server-side Solana on-chain pNode fetching
 * Fetches pNode pubkeys from the Xandeum program index account
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { PNode } from '../types/pnode';
import { XANDEUM_NFT_COLLECTIONS } from '../constants/nft';
import { XANDEUM_ERAS, getItemForVersion, getMilestoneLabel } from '../constants/eras';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
export const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
export const XANDEUM_MAINNET_RPC = 'https://api.mainnet.xandeum.com';
const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

// Helper to wrap promise with timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`RPC request timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

/**
 * Fetch all pNode pubkeys from the on-chain index account
 */
export async function fetchPNodesFromOnChain(rpcUrl: string = DEVNET_RPC): Promise<string[]> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const RPC_TIMEOUT = 30000; // 30 seconds

    // First, get account data length to see how big it is
    const accountInfo = await withTimeout(
      connection.getAccountInfo(INDEX_ACCOUNT, { dataSlice: { offset: 0, length: 0 } }),
      RPC_TIMEOUT
    );

    if (!accountInfo) return [];

    // Fetch data in chunks of 32000 bytes (1000 pubkeys) to be safe with RPC limits
    const dataSize = accountInfo.data.length;
    const pubkeys: string[] = [];
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    // For smaller accounts, just fetch all
    if (dataSize <= 128000) {
      const fullInfo = await withTimeout(connection.getAccountInfo(INDEX_ACCOUNT), RPC_TIMEOUT);
      if (!fullInfo) return [];
      const accountData = fullInfo.data;
      for (let i = 0; i < accountData.length; i += 32) {
        if (i + 32 > accountData.length) break;
        const pk = new PublicKey(accountData.slice(i, i + 32));
        if (!pk.equals(DEFAULT_PUBKEY)) pubkeys.push(pk.toBase58());
      }
    } else {
      // Large account, fetch in chunks
      for (let offset = 0; offset < dataSize; offset += 32000) {
        try {
          const chunkInfo = await withTimeout(
            connection.getAccountInfo(INDEX_ACCOUNT, { dataSlice: { offset, length: 32000 } }),
            RPC_TIMEOUT
          );
          if (chunkInfo && chunkInfo.data) {
            const chunkData = chunkInfo.data;
            for (let i = 0; i < chunkData.length; i += 32) {
              if (i + 32 > chunkData.length) break;
              const pk = new PublicKey(chunkData.slice(i, i + 32));
              if (!pk.equals(DEFAULT_PUBKEY)) pubkeys.push(pk.toBase58());
            }
          }
        } catch (err) {
          console.warn(`[solana-pnodes] Failed to fetch chunk at offset ${offset}:`, (err as Error).message);
        }
      }
    }

    return pubkeys;
  } catch (err) {
    throw new Error(`Failed to fetch pNodes from on-chain: ${(err as Error).message}`);
  }
}

/**
 * Fetch staked XAND in the DAO for a given owner
 */
async function fetchDAOStake(connection: Connection, ownerPubkey: PublicKey): Promise<number> {
  try {
    const accounts = await connection.getProgramAccounts(CUSTOM_GOV_PROGRAM, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(STAKE_ACCOUNT_DISCRIMINATOR) } },
        { memcmp: { offset: 33, bytes: ownerPubkey.toBase58() } }
      ]
    });
    if (accounts.length > 0) {
      let maxStake = 0;
      for (const acc of accounts) {
        const stake = Number(acc.account.data.readBigUInt64LE(66)) / 1e9;
        if (stake > maxStake) maxStake = stake;
      }
      return maxStake;
    }
    return 0;
  } catch (err) {
    if ((err as Error).message?.includes('429')) throw err;
    return 0;
  }
}


/**
 * Enrich a pNode with on-chain data
 */
export async function enrichPNodeWithOnChainData(pubkey: string, connection: Connection, version?: string): Promise<any> {
  const currentRpcUrl = connection.rpcEndpoint;
  const isMainnet = currentRpcUrl.includes('mainnet');

  try {
    const nodePubkey = new PublicKey(pubkey);
    // Use the program ID appropriate for the cluster if it ever changes, for now both are same
    const programId = DEVNET_PROGRAM;

    const [registryAddress] = PublicKey.findProgramAddressSync([Buffer.from('registry'), nodePubkey.toBuffer()], programId);
    const [managerAddress] = PublicKey.findProgramAddressSync([Buffer.from('manager'), nodePubkey.toBuffer()], programId);

    const [balanceRes, voteRes, regRes, manRes] = await Promise.allSettled([
      connection.getBalance(nodePubkey),
      connection.getVoteAccounts(),
      connection.getAccountInfo(registryAddress),
      connection.getAccountInfo(managerAddress)
    ]);

    let balance = balanceRes.status === 'fulfilled' ? balanceRes.value / 1e9 : 0;
    let isValidator = false;
    let validatorInfo: any = undefined;
    if (voteRes.status === 'fulfilled') {
      const va = [...voteRes.value.current, ...voteRes.value.delinquent].find(v => v.nodePubkey === pubkey);
      if (va) {
        isValidator = true;
        validatorInfo = { votePubkey: va.votePubkey, activatedStakeSOL: Number(va.activatedStake) / 1e9 };
      }
    }

    let managerWallet: string | undefined;
    let registrarWallet: string | undefined;
    let eraBoost: number | null = null;
    let eraLabel: string | null = null;
    let milestoneItem: number | null = null;
    let isRegistered = false;

    if (regRes.status === 'fulfilled' && regRes.value) {
      isRegistered = true;
      const data = regRes.value.data;

      // Determine Era from Registry Data
      // Source 1: Offset 32 (u16) - Likely the authoritative "Initial Version" / Era Index
      // Source 2: Offset 8 (Byte) - Fallback for New Gen nodes

      const regEraId = data.readUInt16LE(32);
      const byte8 = data[8];

      let eraId = 1;
      let isNewGen = false;

      // Check Registry Offset 32 first (if valid range 2-14)
      if (regEraId > 1 && regEraId <= 14) {
        eraId = regEraId;
        isNewGen = true;
        // If we found a valid era at 32, we assume it's a new gen node structure
        if (data.length >= 41) registrarWallet = new PublicKey(data.slice(9, 41)).toBase58();
      }
      // Fallback to Byte 8 if Offset 32 is 1 (default) or invalid, but Byte 8 looks like a valid Item Index
      else if (byte8 > 0 && byte8 <= 14) {
        eraId = byte8;
        isNewGen = true;
        if (data.length >= 41) registrarWallet = new PublicKey(data.slice(9, 41)).toBase58();
      } else {
        // Legacy Node or unknown structure
        if (data.length >= 40) registrarWallet = new PublicKey(data.slice(8, 40)).toBase58();
      }

      if (data.length >= 74) {
        const potentialOwner = new PublicKey(data.slice(42, 74)).toBase58();
        if (potentialOwner !== '11111111111111111111111111111111') {
          managerWallet = potentialOwner;
        }
      }

      // Priority 2: Use Era ID from Manager PDA if it exists
      if (manRes.status === 'fulfilled' && manRes.value && manRes.value.data.length >= 33) {
        const mEraId = manRes.value.data[32];
        if (mEraId > 0 && mEraId <= 30) eraId = mEraId;
      }

      // Map Era ID (Item Index) to Label and Boost based on Xandeum roadmap ranges
      // Priority 1: Node Version (if available) - as requested by user
      const eraIdFromVersion = getItemForVersion(version);
      if (eraIdFromVersion > 0) {
        eraId = eraIdFromVersion;
        isNewGen = true;
      }

      // Map to Era Label and Boost using shared constants
      const era = XANDEUM_ERAS.find(e =>
        eraId >= e.minItem && (e.maxItem === undefined || eraId <= e.maxItem)
      ) || XANDEUM_ERAS[0];

      eraLabel = era.name;
      eraBoost = era.boost;

      // Append Milestone Item for clarity - requested by user to include Era, Milestone, and Version
      const milestoneLabel = getMilestoneLabel(eraId);
      eraLabel += ` (${milestoneLabel})`;
      milestoneItem = eraId;
    }

    if (manRes.status === 'fulfilled' && manRes.value && !managerWallet) {
      managerWallet = new PublicKey(manRes.value.data.slice(0, 32)).toBase58();
    }

    const ownerPubkey = managerWallet ? new PublicKey(managerWallet) : nodePubkey;

    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    const [daoStake] = await Promise.all([
      fetchDAOStake(mainnetConn, ownerPubkey)
    ]);

    const vestingStake = 0; // We no longer fetch unclaimed balance here. Handled by sync-rewards.

    let nftBoost = 1;
    try {
      const tas = await mainnetConn.getParsedTokenAccountsByOwner(ownerPubkey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
      for (const ta of tas.value) {
        const match = XANDEUM_NFT_COLLECTIONS.find(c => c.collectionId === ta.account.data.parsed.info.mint);
        if (match && ta.account.data.parsed.info.tokenAmount.uiAmount >= 1) nftBoost = Math.max(nftBoost, match.multiplier);
      }
    } catch (e) { }

    return {
      balance, isValidator, isRegistered, managerWallet, registrarWallet,
      daoStake,
      vestingStake, // This is current vault balance (unclaimed rewards)
      xandStake: daoStake, // Map xandStake ONLY to DAO stake
      nftBoost, eraBoost, eraLabel, milestoneItem, validatorInfo
    };
  } catch (err) {
    if ((err as Error).message?.includes('429')) throw err;
    return { error: (err as Error).message };
  }
}

/**
 * Batched enrichment
 */
export async function enrichPNodesWithOnChainData(pubkeys: string[], rpcUrl: string = DEVNET_RPC): Promise<Map<string, any>> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const results = new Map();
  for (let i = 0; i < pubkeys.length; i += 10) {
    const batch = pubkeys.slice(i, i + 10);
    const batchRes = await Promise.allSettled(batch.map(p => enrichPNodeWithOnChainData(p, connection)));
    batch.forEach((p, idx) => {
      const res = batchRes[idx];
      results.set(p, res.status === 'fulfilled' ? res.value : { error: res.reason });
    });
    if (i + 10 < pubkeys.length) await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

/**
 * Fetch and Enrich
 */
export async function fetchAndEnrichOnChainPNodes(rpcUrl: string = DEVNET_RPC): Promise<PNode[]> {
  const pubkeys = await fetchPNodesFromOnChain(rpcUrl);
  const enrichment = await enrichPNodesWithOnChainData(pubkeys, rpcUrl);
  return pubkeys.map(p => {
    const d = enrichment.get(p) || {};
    return {
      id: p, publicKey: p, pubkey: p,
      ...d, boostFactor: (d.nftBoost || 1) * (d.eraBoost || 1),
      _source: 'onchain'
    } as PNode;
  });
}
