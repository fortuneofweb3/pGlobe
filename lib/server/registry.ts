
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from './mongodb-nodes';

// Configuration
// Using the custom Xandeum Devnet RPC as discovered
const XANDEUM_RPC_URL = process.env.XANDEUM_RPC_URL || 'https://api.devnet.xandeum.com:8899/';
const REGISTRY_PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

export interface RegistrySyncStats {
    totalAccounts: number;
    updatedNodes: number;
    notFoundNodes: number;
    errors: number;
}

/**
 * Fetches the Manager Wallet for a specific pNode from the On-Chain Registry.
 * Uses a memcmp filter to efficiently find the unique account where the pNode key is at offset 0.
 * 
 * @param nodePubkey The Identity Pubkey of the pNode (Base58 string)
 * @returns The Manager Wallet Pubkey (Base58 string) or null if not registered
 */
export async function getManagerForNode(nodePubkey: string): Promise<string | null> {
    try {
        const connection = new Connection(XANDEUM_RPC_URL, 'confirmed');

        // pNode Identity is at Offset 0 (32 bytes)
        const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
            filters: [
                { dataSize: 1040 },
                {
                    memcmp: {
                        offset: 0,
                        bytes: nodePubkey
                    }
                }
            ]
        });

        if (accounts.length === 0) {
            return null;
        }

        // Taking the first match (should be unique)
        const account = accounts[0];
        const data = account.account.data;

        // Manager Wallet is at Offset 42 (32 bytes)
        // Slice 42 to 74 (42 + 32)
        const managerBytes = data.slice(42, 74);
        const managerPubkey = new PublicKey(managerBytes);

        return managerPubkey.toBase58();

    } catch (error) {
        console.error(`Error querying registry for node ${nodePubkey}:`, error);
        return null;
    }
}

/**
 * Syncs ALL managers from the registry to the local database.
 * Useful for bulk updates or periodic maintenance.
 */
export async function syncAllRegistryManagers(): Promise<RegistrySyncStats> {
    const stats: RegistrySyncStats = {
        totalAccounts: 0,
        updatedNodes: 0,
        notFoundNodes: 0,
        errors: 0
    };

    try {
        console.log(`[Registry] Connecting to ${XANDEUM_RPC_URL}`);
        const connection = new Connection(XANDEUM_RPC_URL, 'confirmed');
        const db = await getDb();
        const nodesCollection = db.collection('nodes');

        // Fetch ALL registry accounts
        const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
            filters: [
                { dataSize: 1040 }
            ]
        });

        stats.totalAccounts = accounts.length;
        console.log(`[Registry] Found ${stats.totalAccounts} accounts. Syncing...`);

        for (const { pubkey, account } of accounts) {
            try {
                const data = account.data;
                const pNodePubkey = new PublicKey(data.slice(0, 32)).toBase58();
                const managerWallet = new PublicKey(data.slice(42, 74)).toBase58();

                // Update DB
                const filter = {
                    $or: [
                        { publicKey: pNodePubkey },
                        { pubkey: pNodePubkey },
                        { id: pNodePubkey }
                    ]
                };

                const update = {
                    $set: {
                        managerWallet: managerWallet,
                        registryAccount: pubkey.toBase58(),
                        onChainSyncedAt: new Date()
                    }
                };

                const result = await nodesCollection.updateOne(filter, update);

                if (result.matchedCount > 0) {
                    if (result.modifiedCount > 0) stats.updatedNodes++;
                } else {
                    stats.notFoundNodes++;
                }
            } catch (err) {
                stats.errors++;
            }
        }

    } catch (error) {
        console.error('[Registry] Bulk sync failed:', error);
        throw error;
    }

    return stats;
}
