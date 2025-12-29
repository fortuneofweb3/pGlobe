/**
 * Extract Buyer from Registry PDA at Offset 42
 * 
 * BREAKTHROUGH: Buyer wallet is at OFFSET 42 in Registry PDA!
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

const OWNER_OFFSET = 42;  // DISCOVERED!
const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

async function extractAllBuyers() {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Extracting ALL Buyers from Registry PDAs ===\n');

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

    const nodeToBuyer = new Map();
    let checked = 0;
    let hasRegistry = 0;

    for (const nodeId of nodes) {
        checked++;
        if (checked % 50 === 0) {
            console.log(`Progress: ${checked}/${nodes.length}, linked ${nodeToBuyer.size}...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);
            const [registryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            const info = await devConn.getAccountInfo(registryPDA);
            if (!info || info.data.length < OWNER_OFFSET + 32) continue;

            hasRegistry++;

            // Extract owner from offset 42
            const owner = new PublicKey(info.data.slice(OWNER_OFFSET, OWNER_OFFSET + 32)).toBase58();

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
    console.log(`Nodes with Registry: ${hasRegistry}`);
    console.log(`Nodes linked to Mainnet buyers: ${nodeToBuyer.size}`);
    console.log(`Coverage: ${Math.round(nodeToBuyer.size / nodes.length * 100)}%`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

extractAllBuyers().catch(console.error);
