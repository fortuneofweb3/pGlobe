/**
 * Link Registrar Wallets to Mainnet Buyers
 * 
 * For each node in the DB with a registrarWallet, check if that registrar 
 * wallet has a Manager PDA on Devnet. If it does, the first 32 bytes of 
 * the Manager PDA data should point to a Mainnet buyer wallet (or be the 
 * same wallet).
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

async function linkRegistrarsToBuyers() {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Linking Registrar Wallets to Mainnet Buyers ===\n');

    // 1. Get Mainnet buyer wallets
    console.log('Fetching Mainnet buyer wallets...');
    const mainnetAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetBuyers = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Found ${mainnetBuyers.size} Mainnet buyers.`);

    // 2. Get all nodes from the index
    console.log('Fetching Devnet nodes...');
    const indexInfo = await devConn.getAccountInfo(INDEX_ACCOUNT);
    const nodes = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(pk.toBase58());
        }
    }
    console.log(`Found ${nodes.length} nodes.\n`);

    // 3. For each node, get its Registry PDA and extract registrar
    console.log('Scanning nodes for Registrar -> Buyer links...');

    const nodeToBuyer = new Map();
    let checked = 0;

    for (const nodeId of nodes) {
        checked++;
        if (checked % 50 === 0) {
            console.log(`Progress: ${checked}/${nodes.length} nodes, ${nodeToBuyer.size} linked...`);
        }

        try {
            const nodePubkey = new PublicKey(nodeId);

            // Get Registry PDA  (seed: ['registry', nodePubkey])
            const [registryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            const registryInfo = await devConn.getAccountInfo(registryPDA);
            if (!registryInfo || registryInfo.data.length < 32) continue;

            // First 32 bytes of registry = registrar wallet (who called register)
            const registrarWallet = new PublicKey(registryInfo.data.slice(0, 32)).toBase58();

            // Now check if this registrar wallet has a Manager PDA
            const [managerPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('manager'), new PublicKey(registrarWallet).toBuffer()],
                DEVNET_PROGRAM
            );

            const managerInfo = await devConn.getAccountInfo(managerPDA);
            if (managerInfo && managerInfo.data.length >= 32) {
                // The first 32 bytes of Manager PDA = the "authority" = Mainnet Buyer (if any)
                const authority = new PublicKey(managerInfo.data.slice(0, 32)).toBase58();

                // If authority is in Mainnet buyers, we have a link!
                if (mainnetBuyers.has(authority)) {
                    nodeToBuyer.set(nodeId, authority);
                    console.log(`  ✅ ${nodeId.slice(0, 8)}... -> ${authority.slice(0, 8)}... (via registrar ${registrarWallet.slice(0, 8)}...)`);
                } else if (authority === registrarWallet) {
                    // Authority = Registrar = Buyer (same wallet)
                    if (mainnetBuyers.has(registrarWallet)) {
                        nodeToBuyer.set(nodeId, registrarWallet);
                        console.log(`  ✅ ${nodeId.slice(0, 8)}... -> ${registrarWallet.slice(0, 8)}... (same wallet)`);
                    }
                }
            }
        } catch (e) {
            // Skip errors
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 30));
    }

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
    console.log(`Mappings discovered: ${nodeToBuyer.size}`);
    console.log(`Coverage: ${Math.round(nodeToBuyer.size / nodes.length * 100)}%`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

linkRegistrarsToBuyers().catch(console.error);
