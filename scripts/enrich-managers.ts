
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '../lib/server/mongodb-nodes';
import { XANDEUM_NFT_COLLECTIONS } from '../lib/constants/nft';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const CUSTOM_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const STAKE_ACCOUNT_DISCRIMINATOR = Buffer.from('0cb8a1410fd63b6e', 'hex');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDAOStake(connection: Connection, ownerPubkey: PublicKey): Promise<number> {
    let retries = 5;
    let delay = 1000;

    while (retries > 0) {
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
            return 0; // No account found, this is a valid result (0 stake)
        } catch (err: any) {
            const msg = err.message || '';
            if (msg.includes('429') || msg.includes('limit')) {
                console.log(`  Rate limit (fetchStake). Waiting ${delay}ms...`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
                retries--;
            } else {
                console.warn(`Error fetching stake for ${ownerPubkey.toBase58()}:`, msg);
                return 0; // Other error, assume 0
            }
        }
    }
    console.warn(`Failed to fetch stake for ${ownerPubkey.toBase58()} after retries.`);
    return 0;
}

async function enrichManagers() {
    console.log('Starting Manager Enrichment...');
    console.log('RPC URL:', RPC_URL);

    const connection = new Connection(RPC_URL, 'confirmed');
    const db = await getDb();
    const collection = db.collection('nodes');

    // 1. Get all nodes with a managerWallet
    const nodes = await collection.find({ managerWallet: { $exists: true, $ne: null } }).toArray();
    console.log(`Found ${nodes.length} nodes with manager wallets.`);

    // 2. Group by managerWallet
    const managers = new Set<string>();
    nodes.forEach((n: any) => {
        if (n.managerWallet) managers.add(n.managerWallet);
    });

    const uniqueManagers = Array.from(managers);
    console.log(`Found ${uniqueManagers.length} unique managers.`);

    // 3. Process each manager
    let processed = 0;

    for (const managerWallet of uniqueManagers) {
        processed++;
        console.log(`[${processed}/${uniqueManagers.length}] Processing Manager: ${managerWallet}`);

        try {
            const ownerPubkey = new PublicKey(managerWallet);

            // Fetch Stake
            const xandStake = await fetchDAOStake(connection, ownerPubkey);

            // Fetch NFTs
            let nftBoost = 1;
            const nftDetails: any[] = [];

            try {
                const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
                    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                });

                for (const account of parsedTokenAccounts.value) {
                    const info = account.account.data.parsed.info;
                    const mint = info.mint;
                    const amount = info.tokenAmount.uiAmount;

                    if (amount >= 1) {
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
                console.warn(`Failed to fetch NFTs for ${managerWallet}`);
            }

            // Update all nodes for this manager
            // We update xandStake, nftBoost, nftDetails, AND recalculate boostFactor
            // boostFactor = nftBoost * eraBoost (we need to preserve existing eraBoost)

            // Since eraBoost varies per node, we can't do a single bulk update for boostFactor perfectly
            // BUT, strictly speaking, boostFactor = nftBoost * eraBoost.
            // Use an aggregation pipeline update to multiply existing eraBoost by new nftBoost?
            // Or simpler: update xandStake/nftBoost first.
            // THEN, update boostFactor: boostFactor = nftBoost * (eraBoost || 1)

            // 1. Set the common fields
            await collection.updateMany(
                { managerWallet: managerWallet },
                {
                    $set: {
                        xandStake,
                        nftBoost,
                        nftDetails
                    }
                }
            );

            // 2. Update boostFactor using aggregation pipeline (requires MongoDB 4.2+)
            await collection.updateMany(
                { managerWallet: managerWallet },
                [
                    {
                        $set: {
                            boostFactor: {
                                $multiply: [
                                    { $ifNull: ["$nftBoost", 1] },
                                    { $ifNull: ["$eraBoost", 1] }
                                ]
                            }
                        }
                    }
                ]
            );

            console.log(`  > Updated ${managerWallet}: Stake=${xandStake}, NFTBoost=${nftBoost}x`);

        } catch (err) {
            console.error(`Failed to process manager ${managerWallet}:`, err);
        }

        // Rate limit protection
        await sleep(500);
    }

    console.log('Manager Enrichment Complete.');
    process.exit(0);
}

enrichManagers();
