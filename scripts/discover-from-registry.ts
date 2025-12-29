/**
 * Extract Registrar Wallet from Registry PDA
 * 
 * For each Devnet node, derive its Registry PDA and extract the registrar wallet
 * from the account data structure (Offset 8).
 * 
 * Based on earlier research:
 * - Registry PDA size: 1040 bytes
 * - Offset 0: Node Public Key (32 bytes)
 * - Offset 8: Registrar Wallet (32 bytes) - The Devnet wallet that registered the node
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

interface Mapping {
    nodeId: string;
    registrarWallet: string;
    discoveredAt: string;
    method: string;
}

const OUTPUT_FILE = path.join(__dirname, 'data', 'registrar-wallets.json');

async function discoverFromRegistryPDA() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');

    // Get Devnet nodes
    console.log('Fetching Devnet nodes...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes: string[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.push(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.length} nodes.\n`);

    // For each node, derive Registry PDA and extract wallet from data
    console.log('Extracting registrar wallets from Registry PDAs...\n');
    const mappings: Mapping[] = [];
    let checked = 0;
    let found = 0;

    for (const nodeId of devnetNodes) {
        checked++;
        if (checked % 50 === 0) {
            console.log(`  Progress: ${checked}/${devnetNodes.length} nodes checked...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);

            // Derive Registry PDA
            const [registryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            const registryInfo = await devnetConn.getAccountInfo(registryPDA);
            if (!registryInfo || registryInfo.data.length < 40) {
                continue;
            }

            // Extract wallet at offset 8
            const registrarWallet = new PublicKey(registryInfo.data.slice(8, 40)).toBase58();

            if (registrarWallet !== '11111111111111111111111111111111') {
                mappings.push({
                    nodeId,
                    registrarWallet,
                    discoveredAt: new Date().toISOString(),
                    method: 'registry_pda_offset_8'
                });
                found++;
                // console.log(`  ✅ ${nodeId.slice(0, 8)}... -> ${registrarWallet.slice(0, 8)}...`);
            }
        } catch { }
    }

    // Save results
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Nodes checked: ${checked}`);
    console.log(`Registrar wallets found: ${found}`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

discoverFromRegistryPDA().catch(console.error);
