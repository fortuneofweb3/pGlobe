/**
 * Parse Registry PDAs to Find Node Owners
 * 
 * FROM SOURCE CODE (transactions.js):
 * - Registry PDA = ['registry', node_pubkey] -> Stores info about the node
 * - Manager PDA = ['manager', owner_wallet] -> Stores owner's registration count
 * 
 * The Registry PDA likely contains the OWNER wallet address!
 * Let's inspect its structure.
 * 
 * From pNodeHelpers.ts:
 * - Manager PDA: bytes 0-32 = owner, byte 32 = purchased, byte 33 = registered
 * 
 * Registry PDA structure is unknown - let's discover it!
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

async function parseRegistryPDAs() {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Parsing Registry PDAs for Node-Owner Links ===\n');

    // Get Mainnet buyers for validation
    const mainAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetBuyers = new Set();
    for (const acc of mainAccounts) {
        mainnetBuyers.add(new PublicKey(acc.account.data.slice(0, 32)).toBase58());
    }
    console.log(`Mainnet buyers: ${mainnetBuyers.size}`);

    // Get Devnet nodes
    const indexInfo = await devConn.getAccountInfo(INDEX_ACCOUNT);
    const nodes = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(pk.toBase58());
        }
    }
    console.log(`Devnet nodes: ${nodes.length}\n`);

    // Analyze first 5 Registry PDAs to discover structure
    console.log('--- Analyzing Registry PDA Structure (first 5) ---\n');

    for (let i = 0; i < Math.min(5, nodes.length); i++) {
        const nodeId = nodes[i];
        const nodePubkey = new PublicKey(nodeId);

        const [registryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePubkey.toBuffer()],
            DEVNET_PROGRAM
        );

        const info = await devConn.getAccountInfo(registryPDA);
        if (!info) {
            console.log(`Node ${nodeId.slice(0, 8)}...: No Registry PDA`);
            continue;
        }

        console.log(`Node ${nodeId.slice(0, 8)}... Registry PDA (${info.data.length} bytes):`);

        // Try to interpret first 32 bytes as owner
        if (info.data.length >= 32) {
            const possibleOwner = new PublicKey(info.data.slice(0, 32)).toBase58();
            const isMainnetBuyer = mainnetBuyers.has(possibleOwner);
            console.log(`  Bytes 0-32: ${possibleOwner.slice(0, 12)}... ${isMainnetBuyer ? '✅ MAINNET BUYER!' : ''}`);
        }

        // Show remaining bytes
        if (info.data.length > 32) {
            console.log(`  Remaining (hex): ${info.data.slice(32).toString('hex').slice(0, 40)}...`);
        }
        console.log('');
    }

    // Now parse ALL Registry PDAs
    console.log('--- Extracting owner from ALL Registry PDAs ---\n');

    const nodeToBuyer = new Map();
    let checked = 0;
    let hasRegistry = 0;

    for (const nodeId of nodes) {
        checked++;
        if (checked % 50 === 0) {
            console.log(`Progress: ${checked}/${nodes.length}, found ${nodeToBuyer.size}...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);
            const [registryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            const info = await devConn.getAccountInfo(registryPDA);
            if (!info || info.data.length < 32) continue;

            hasRegistry++;

            // Extract owner from first 32 bytes
            const owner = new PublicKey(info.data.slice(0, 32)).toBase58();

            // Only link if owner is a Mainnet buyer
            if (mainnetBuyers.has(owner)) {
                nodeToBuyer.set(nodeId, owner);
            }
        } catch (e) { }

        await new Promise(r => setTimeout(r, 30));
    }

    console.log(`\nNodes with Registry PDA: ${hasRegistry}`);
    console.log(`Nodes linked to Mainnet buyers: ${nodeToBuyer.size}`);

    // Save results
    const mappings = Array.from(nodeToBuyer.entries()).map(([nodeId, managerWallet]) => ({
        nodeId,
        managerWallet,
        discoveredAt: new Date().toISOString()
    }));

    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Total nodes: ${nodes.length}`);
    console.log(`Nodes linked to Mainnet buyers: ${nodeToBuyer.size}`);
    console.log(`Coverage: ${Math.round(nodeToBuyer.size / nodes.length * 100)}%`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

parseRegistryPDAs().catch(console.error);
