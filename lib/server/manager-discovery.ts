/**
 * Manager Wallet Discovery
 * 
 * Discovers the Mainnet manager wallet for a pNode by:
 * 1. Getting all Mainnet pNode purchase wallets
 * 2. Checking which have Manager PDAs on Devnet with registrations
 * 3. Scanning their Devnet transaction history to find which nodes they registered
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

// Cache connections
let devnetConn: Connection | null = null;
let mainnetConn: Connection | null = null;

function getDevnetConnection(): Connection {
    if (!devnetConn) {
        devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    }
    return devnetConn;
}

function getMainnetConnection(): Connection {
    if (!mainnetConn) {
        mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
    }
    return mainnetConn;
}

// Cache for Mainnet wallets (wallet -> purchase count)
let mainnetPurchaseStatsCache: Map<string, number> | null = null;
let mainnetCacheTime = 0;
const MAINNET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for Devnet nodes
let devnetNodesCache: Set<string> | null = null;
let devnetCacheTime = 0;
const DEVNET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

import { getManagerStatsCollection } from './mongodb-nodes';

export async function getManagerPurchaseStats(): Promise<Map<string, number>> {
    // Try to read from MongoDB first
    try {
        const collection = await getManagerStatsCollection();
        const docs = await collection.find({}).toArray();
        if (docs.length > 0) {
            const stats = new Map<string, number>();
            for (const doc of docs) {
                stats.set(doc.wallet, doc.purchaseCount);
            }
            console.log(`[ManagerDiscovery] ✅ Loaded ${stats.size} manager stats from MongoDB`);
            return stats;
        }
    } catch (e) {
        console.warn(`[ManagerDiscovery] ⚠️ Failed to read stats from DB:`, (e as Error).message);
    }

    const now = Date.now();
    if (mainnetPurchaseStatsCache && (now - mainnetCacheTime) < MAINNET_CACHE_TTL) {
        return mainnetPurchaseStatsCache;
    }

    // Fallback: Fetch from on-chain (and maybe we should save to DB?)
    // For now, let's keep the existing logic but logging it
    console.log('[ManagerDiscovery] ⚠️ MongoDB empty or unavailable, fetching from on-chain...');

    mainnetPurchaseStatsCache = await fetchManagerPurchaseStatsFromChain();
    mainnetCacheTime = now;

    console.log(`[ManagerDiscovery] Loaded stats for ${mainnetPurchaseStatsCache.size} Mainnet wallets`);
    return mainnetPurchaseStatsCache;
}

/**
 * Fetch fresh manager stats directly from Mainnet
 */
export async function fetchManagerPurchaseStatsFromChain(): Promise<Map<string, number>> {
    const conn = getMainnetConnection();
    const accounts = await conn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    const stats = new Map<string, number>();
    for (const acc of accounts) {
        const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
        // Count represents number of purchases, stored at offset 32 (u8)
        const count = acc.account.data.readUInt8(32);
        stats.set(wallet, count);
    }

    return stats;
}

async function getMainnetWallets(): Promise<Set<string>> {
    const stats = await getManagerPurchaseStats();
    return new Set(stats.keys());
}

async function getDevnetNodes(): Promise<Set<string>> {
    const now = Date.now();
    if (devnetNodesCache && (now - devnetCacheTime) < DEVNET_CACHE_TTL) {
        return devnetNodesCache;
    }

    const conn = getDevnetConnection();
    const indexInfo = await conn.getAccountInfo(DEVNET_INDEX);

    devnetNodesCache = new Set<string>();
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const key = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (key.toBase58() !== '11111111111111111111111111111111') {
                devnetNodesCache.add(key.toBase58());
            }
        }
    }
    devnetCacheTime = now;

    console.log(`[ManagerDiscovery] Loaded ${devnetNodesCache.size} Devnet nodes`);
    return devnetNodesCache;
}

/**
 * Discover manager wallet for a single node by scanning transaction history
 * of known Mainnet wallets that have registrations on Devnet.
 */
export async function discoverManagerWallet(nodePubkey: string): Promise<string | null> {
    try {
        const mainnetWallets = await getMainnetWallets();
        const devnetNodes = await getDevnetNodes();
        const conn = getDevnetConnection();

        // Check if node is even a known Devnet node
        if (!devnetNodes.has(nodePubkey)) {
            return null;
        }

        // For each Mainnet wallet, check if they have a Manager PDA with registrations
        // and if so, scan their tx history for this specific node
        for (const wallet of mainnetWallets) {
            try {
                const walletPubkey = new PublicKey(wallet);
                const [managerPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from('manager'), walletPubkey.toBuffer()],
                    DEVNET_PROGRAM
                );

                const managerInfo = await conn.getAccountInfo(managerPDA);
                if (!managerInfo || managerInfo.data.length !== 34 || managerInfo.data[33] === 0) {
                    continue; // No registrations
                }

                // Scan wallet's transaction history for this node
                const sigs = await conn.getSignaturesForAddress(walletPubkey, { limit: 100 });

                for (const sig of sigs) {
                    const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    // Check if tx involves the Devnet Program
                    const involvesProgram = tx.transaction.message.accountKeys.some(
                        a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                    );
                    if (!involvesProgram) continue;

                    // Check if our target node is in the accounts
                    const containsNode = tx.transaction.message.accountKeys.some(
                        a => a.pubkey.toBase58() === nodePubkey
                    );
                    if (containsNode) {
                        console.log(`[ManagerDiscovery] Found wallet ${wallet.slice(0, 8)}... for node ${nodePubkey.slice(0, 8)}...`);
                        return wallet;
                    }
                }
            } catch {
                // Skip errors for individual wallets
            }
        }

        return null;
    } catch (error) {
        console.error('[ManagerDiscovery] Error:', error);
        return null;
    }
}

/**
 * Batch discover manager wallets for multiple nodes.
 * More efficient than calling discoverManagerWallet for each node.
 */
export async function discoverManagerWalletsBatch(
    nodePubkeys: string[]
): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    if (nodePubkeys.length === 0) {
        return results;
    }

    try {
        const mainnetWallets = await getMainnetWallets();
        const devnetNodes = await getDevnetNodes();
        const conn = getDevnetConnection();

        // Filter to only valid Devnet nodes
        const targetNodes = new Set(nodePubkeys.filter(n => devnetNodes.has(n)));
        if (targetNodes.size === 0) {
            return results;
        }

        console.log(`[ManagerDiscovery] Scanning for ${targetNodes.size} nodes...`);

        // For each Mainnet wallet with registrations, scan their tx history
        for (const wallet of mainnetWallets) {
            // Stop if we found all nodes
            if (results.size >= targetNodes.size) break;

            try {
                const walletPubkey = new PublicKey(wallet);
                const [managerPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from('manager'), walletPubkey.toBuffer()],
                    DEVNET_PROGRAM
                );

                const managerInfo = await conn.getAccountInfo(managerPDA);
                if (!managerInfo || managerInfo.data.length !== 34 || managerInfo.data[33] === 0) {
                    continue;
                }

                // Scan wallet's transaction history
                const sigs = await conn.getSignaturesForAddress(walletPubkey, { limit: 100 });

                for (const sig of sigs) {
                    const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                    if (!tx) continue;

                    const involvesProgram = tx.transaction.message.accountKeys.some(
                        a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                    );
                    if (!involvesProgram) continue;

                    // Check for any of our target nodes
                    for (const acc of tx.transaction.message.accountKeys) {
                        const pubkey = acc.pubkey.toBase58();
                        if (targetNodes.has(pubkey) && !results.has(pubkey)) {
                            results.set(pubkey, wallet);
                            console.log(`[ManagerDiscovery] Found: ${pubkey.slice(0, 8)}... -> ${wallet.slice(0, 8)}...`);
                        }
                    }
                }
            } catch {
                // Skip errors
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`[ManagerDiscovery] Discovered ${results.size}/${targetNodes.size} manager wallets`);
        return results;
    } catch (error) {
        console.error('[ManagerDiscovery] Batch error:', error);
        return results;
    }
}

/**
 * Get all manager wallets with their node counts
 */
export async function getAllManagers(): Promise<{ wallet: string; nodeCount: number }[]> {
    try {
        const mainnetWallets = await getMainnetWallets();
        const conn = getDevnetConnection();
        const managers: { wallet: string; nodeCount: number }[] = [];

        for (const wallet of mainnetWallets) {
            try {
                const walletPubkey = new PublicKey(wallet);
                const [managerPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from('manager'), walletPubkey.toBuffer()],
                    DEVNET_PROGRAM
                );

                const managerInfo = await conn.getAccountInfo(managerPDA);
                if (managerInfo && managerInfo.data.length === 34) {
                    const registered = managerInfo.data[33];
                    if (registered > 0) {
                        managers.push({ wallet, nodeCount: registered });
                    }
                }
            } catch {
                // Skip errors
            }
        }

        return managers.sort((a, b) => b.nodeCount - a.nodeCount);
    } catch (error) {
        console.error('[ManagerDiscovery] Error getting managers:', error);
        return [];
    }
}
