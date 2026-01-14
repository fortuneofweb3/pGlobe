
import { getDb } from '../lib/server/mongodb-nodes';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function importManagerCsv() {
    console.log('Starting Manager CSV Import...');

    // Path to CSV file
    const csvPath = path.resolve(process.cwd(), 'pnodes-data-2026-01-14 (1).csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found at: ${csvPath}`);
        process.exit(1);
    }

    console.log(`Reading CSV from: ${csvPath}`);
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    console.log(`Found ${records.length} records in CSV.`);

    const db = await getDb();
    const nodesCollection = db.collection('nodes');

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const record of records) {
        // CSV Headers based on user provided file:
        // Index, pNode Identity Pubkey, Manager, Registered Time, Version

        const nodePubkey = record['pNode Identity Pubkey'];
        const managerWallet = record['Manager'];

        if (!nodePubkey || !managerWallet) {
            console.warn('Skipping invalid record:', record);
            continue;
        }

        try {
            // Find node by publicKey (or id, or pubkey)
            // We use diverse criteria to match however it's stored
            const filter = {
                $or: [
                    { publicKey: nodePubkey },
                    { pubkey: nodePubkey },
                    { id: nodePubkey }
                ]
            };

            const update = {
                $set: {
                    managerWallet: managerWallet
                }
            };

            const result = await nodesCollection.updateOne(filter, update);

            if (result.matchedCount > 0) {
                if (result.modifiedCount > 0) {
                    process.stdout.write('.'); // Dot for progress
                    updatedCount++;
                } else {
                    // Matched but not modified (already set)
                    process.stdout.write('-');
                }
            } else {
                console.log(`\nNode not found for pubkey: ${nodePubkey}`);
                notFoundCount++;
            }

        } catch (err) {
            console.error(`\nError updating node ${nodePubkey}:`, err);
            errorCount++;
        }
    }

    console.log('\n\nImport Summary:');
    console.log(`----------------`);
    console.log(`Total Records: ${records.length}`);
    console.log(`Updated Nodes: ${updatedCount}`);
    console.log(`Nodes Not Found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);

    process.exit(0);
}

importManagerCsv().catch(console.error);
