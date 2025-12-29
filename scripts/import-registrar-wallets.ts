import 'dotenv/config';
import { getNodesCollection, isValidPubkey } from '../lib/server/mongodb-nodes';
import * as fs from 'fs';
import * as path from 'path';

const MAPPINGS_FILE = path.join(__dirname, 'data', 'registrar-wallets.json');

interface Mapping {
    nodeId: string;
    registrarWallet: string;
    discoveredAt?: string;
}

async function importRegistrarWallets() {
    try {
        // Load mappings from file
        if (!fs.existsSync(MAPPINGS_FILE)) {
            console.error(`Mappings file not found: ${MAPPINGS_FILE}`);
            process.exit(1);
        }

        const mappings: Mapping[] = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8'));
        console.log(`Loaded ${mappings.length} registrar mappings from file.`);

        // Get MongoDB collection
        const collection = await getNodesCollection();

        // Update each node with its registrar wallet
        let updated = 0;
        let skipped = 0;

        for (const mapping of mappings) {
            if (!isValidPubkey(mapping.nodeId) || !isValidPubkey(mapping.registrarWallet)) {
                console.warn(`Invalid mapping: ${mapping.nodeId} -> ${mapping.registrarWallet}`);
                skipped++;
                continue;
            }

            const result = await collection.updateOne(
                { _id: mapping.nodeId as any },
                { $set: { registrarWallet: mapping.registrarWallet } }
            );

            if (result.matchedCount > 0) {
                updated++;
            } else {
                skipped++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Import Complete`);
        console.log(`========================================`);
        console.log(`Nodes updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);

        process.exit(0);
    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    }
}

importRegistrarWallets();
