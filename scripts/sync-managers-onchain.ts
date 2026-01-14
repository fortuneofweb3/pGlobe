
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '../lib/server/mongodb-nodes';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const XANDEUM_RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const REGISTRY_PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function syncManagersOnChain() {
    console.log('Starting On-Chain Manager Sync...');
    console.log(`Connecting to ${XANDEUM_RPC_URL}`);

    const connection = new Connection(XANDEUM_RPC_URL, 'confirmed');
    const db = await getDb();
    const nodesCollection = db.collection('nodes');

    // 1. Fetch Registry Accounts
    console.log('Fetching registry accounts...');
    const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
        filters: [
            { dataSize: 1040 }
        ]
    });
    console.log(`Found ${accounts.length} registry accounts.`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    // 2. Process each account
    for (const { pubkey, account } of accounts) {
        try {
            const data = account.data;

            // Layout defined by previous analysis:
            // Node Identity: Offset 0 (32 bytes)
            // Manager Wallet: Offset 42 (32 bytes)

            const pNodePubkey = new PublicKey(data.slice(0, 32)).toBase58();
            const managerWallet = new PublicKey(data.slice(42, 74)).toBase58();

            // 3. Update DB
            // We match by `publicKey` or `pubkey` or `id`
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
                    registryAccount: pubkey.toBase58(), // Keep track of source account
                    onChainSyncedAt: new Date()
                }
            };

            const result = await nodesCollection.updateOne(filter, update);

            if (result.matchedCount > 0) {
                if (result.modifiedCount > 0) {
                    process.stdout.write('.');
                    updatedCount++;
                } else {
                    process.stdout.write('-'); // Matched but same value
                }
            } else {
                // If not found, we might need to create it? 
                // For now, just log. The CSV import had many missing nodes too.
                // console.log(`\nNode not found: ${pNodePubkey} (Manager: ${managerWallet})`);
                notFoundCount++;
            }

        } catch (err) {
            console.error(`\nError processing account ${pubkey.toBase58()}:`, err);
            errorCount++;
        }
    }

    console.log('\n\nSync Summary:');
    console.log(`----------------`);
    console.log(`Total Registry Accounts: ${accounts.length}`);
    console.log(`Updated Nodes: ${updatedCount}`);
    console.log(`Nodes Not Found in DB: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);

    process.exit(0);
}

syncManagersOnChain().catch(console.error);
