/**
 * Server-side Solana on-chain pNode fetching
 * Fetches pNode pubkeys from the Xandeum program index account
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { PNode } from '../types/pnode';
import { XANDEUM_NFT_COLLECTIONS } from '../constants/nft';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

/**
 * Fetch all pNode pubkeys from the on-chain index account
 */
export async function fetchPNodesFromOnChain(rpcUrl: string = DEVNET_RPC): Promise<string[]> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const accountInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (!accountInfo || !accountInfo.data) return [];

    const accountData = accountInfo.data;
    const pubkeys: string[] = [];
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    for (let i = 0; i < accountData.length; i += 32) {
      if (i + 32 > accountData.length) break;
      try {
        const pubkey = new PublicKey(accountData.slice(i, i + 32));
        if (!pubkey.equals(DEFAULT_PUBKEY)) pubkeys.push(pubkey.toBase58());
      } catch (e) { continue; }
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
 * Fetch Vesting Stake for a manager
 */
async function fetchVestingStake(connection: Connection, managerWallet: PublicKey): Promise<number> {
  try {
    let totalVesting = 0;
    const grantAccounts = await connection.getProgramAccounts(VESTING_PROGRAM, {
      filters: [{ memcmp: { offset: 8, bytes: managerWallet.toBase58() } }]
    });
    for (const { pubkey: grantAccount } of grantAccounts) {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(grantAccount, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });
      for (const ta of tokenAccounts.value) {
        const info = ta.account.data.parsed.info;
        if (info.mint === 'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx') {
          totalVesting += info.tokenAmount.uiAmount || 0;
        }
      }
    }
    return totalVesting;
  } catch (err) {
    if ((err as Error).message?.includes('429')) throw err;
    return 0;
  }
}

/**
 * Enrich a pNode with on-chain data
 */
export async function enrichPNodeWithOnChainData(pubkey: string, connection: Connection): Promise<any> {
  try {
    const nodePubkey = new PublicKey(pubkey);
    const [registryAddress] = PublicKey.findProgramAddressSync([Buffer.from('registry'), nodePubkey.toBuffer()], DEVNET_PROGRAM);
    const [managerAddress] = PublicKey.findProgramAddressSync([Buffer.from('manager'), nodePubkey.toBuffer()], DEVNET_PROGRAM);

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
    let eraBoost = 1;
    let eraLabel = 'Standard';
    let isRegistered = false;

    if (regRes.status === 'fulfilled' && regRes.value) {
      isRegistered = true;
      const data = regRes.value.data;
      if (data.length >= 40) registrarWallet = new PublicKey(data.slice(8, 40)).toBase58();
      if (data.length >= 74) managerWallet = new PublicKey(data.slice(42, 74)).toBase58();
      if (data.length >= 82) {
        const price = Number(data.readBigUInt64LE(34)) / 1e9;
        if (price > 0) {
          if (price < 2.0) { eraBoost = 16; eraLabel = 'Deep South Era'; }
          else if (price < 3.0) { eraBoost = 10; eraLabel = 'South Era'; }
          else if (price < 4.0) { eraBoost = 7; eraLabel = 'Main Era'; }
          else if (price < 5.0) { eraBoost = 3.5; eraLabel = 'Coal Era'; }
          else if (price < 6.0) { eraBoost = 2; eraLabel = 'Central Era'; }
          else { eraBoost = 1.25; eraLabel = 'North Era'; }
        }
      }
    }

    if (manRes.status === 'fulfilled' && manRes.value && !managerWallet) {
      managerWallet = new PublicKey(manRes.value.data.slice(0, 32)).toBase58();
    }

    const ownerPubkey = managerWallet ? new PublicKey(managerWallet) : nodePubkey;
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    const [daoStake, vestingStake] = await Promise.all([
      fetchDAOStake(mainnetConn, ownerPubkey),
      fetchVestingStake(mainnetConn, ownerPubkey)
    ]);

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
      nftBoost, eraBoost, eraLabel, validatorInfo
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
