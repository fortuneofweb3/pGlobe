import 'dotenv/config';
import { getNodesCollection, isValidPubkey } from '../lib/server/mongodb-nodes';
import * as fs from 'fs';
import * as path from 'path';

const MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'node-wallet-mappings.json');

interface Mapping {
    nodeId: string;
    managerWallet: string;
    discoveredAt?: string;
}

async function importMappings() {
    try {
        // Load mappings from file
        if (!fs.existsSync(MAPPINGS_FILE)) {
            console.error(`Mappings file not found: ${MAPPINGS_FILE}`);
            process.exit(1);
        }

        const mappings: Mapping[] = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8'));
        console.log(`Loaded ${mappings.length} mappings from file.`);

        // Get MongoDB collection
        const collection = await getNodesCollection();

        // Update each node with its manager wallet
        let updated = 0;
        let skipped = 0;

        for (const mapping of mappings) {
            if (!isValidPubkey(mapping.nodeId) || !isValidPubkey(mapping.managerWallet)) {
                console.warn(`Invalid mapping: ${mapping.nodeId} -> ${mapping.managerWallet}`);
                skipped++;
                continue;
            }

            const result = await collection.updateOne(
                { _id: mapping.nodeId },
                { $set: { managerWallet: mapping.managerWallet } }
            );

            if (result.matchedCount > 0) {
                updated++;
                console.log(`✅ ${mapping.nodeId.slice(0, 8)}... -> ${mapping.managerWallet.slice(0, 8)}...`);
            } else {
                console.log(`⚠️  Node not found: ${mapping.nodeId.slice(0, 8)}...`);
                skipped++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Import Complete`);
        console.log(`========================================`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);

        process.exit(0);
    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    }
}

importMappings();
