
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function scanManagerPDAs() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get Mainnet wallets
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Mainnet has ${mainnetWallets.size} wallets.\n`);

    // Get ALL Manager PDAs from Devnet (size 34)
    console.log('Fetching Devnet Manager PDAs (size 34)...');
    const managerAccounts = await devnetConn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 34 }]
    });
    console.log(`Found ${managerAccounts.length} Manager PDAs.\n`);

    // Parse each Manager PDA
    // Structure: owner (32 bytes) + purchased (1 byte) + registered (1 byte)
    const managerData: { pda: string, owner: string, purchased: number, registered: number, isMainnet: boolean }[] = [];

    for (const acc of managerAccounts) {
        const owner = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
        const purchased = acc.account.data[32];
        const registered = acc.account.data[33];
        const isMainnet = mainnetWallets.has(owner);

        managerData.push({
            pda: acc.pubkey.toBase58(),
            owner,
            purchased,
            registered,
            isMainnet
        });
    }

    // Filter to those with registrations and Mainnet wallets
    const mainnetManagers = managerData.filter(m => m.isMainnet && m.registered > 0);
    console.log(`Managers with Mainnet wallets AND registered pNodes: ${mainnetManagers.length}\n`);

    if (mainnetManagers.length > 0) {
        console.log('--- Mainnet-Verified Managers ---');
        for (const m of mainnetManagers) {
            console.log(`  Owner: ${m.owner}`);
            console.log(`    Purchased: ${m.purchased}, Registered: ${m.registered}`);
            console.log(`    Manager PDA: ${m.pda}`);
            console.log('');
        }
    }

    // Now I need to find which Nodes are owned by these Managers
    // The challenge: Manager PDA only stores counts, not node list!
    // Alternative: Check if any Registry has these wallets at offset 8
    console.log('Checking if any Registry has Mainnet wallet at offset 8...');
    const mainnetOwnerSet = new Set(mainnetManagers.map(m => m.owner));

    // Get all Registries (size 1040)
    const registries = await devnetConn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });
    console.log(`Found ${registries.length} Registries.\n`);

    const nodeToManager = new Map<string, string>();

    for (const reg of registries) {
        const nodeKey = new PublicKey(reg.account.data.slice(0, 32)).toBase58();
        const key8 = new PublicKey(reg.account.data.slice(8, 40)).toBase58();

        // Check if key8 is a Mainnet wallet
        if (mainnetWallets.has(key8)) {
            nodeToManager.set(nodeKey, key8);
            console.log(`✅ Node ${nodeKey.slice(0, 8)}... -> Manager ${key8.slice(0, 8)}... (Mainnet ✓)`);
        }
    }

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Total Manager PDAs: ${managerData.length}`);
    console.log(`Managers with Mainnet wallets: ${mainnetManagers.length}`);
    console.log(`Nodes linked to Mainnet wallets: ${nodeToManager.size}`);

    // If we found any, output JSON
    if (nodeToManager.size > 0) {
        console.log(`\n--- JSON Mappings ---`);
        const mappings = Array.from(nodeToManager.entries()).map(([node, wallet]) => ({
            nodeId: node,
            managerWallet: wallet,
            isMainnetVerified: true
        }));
        console.log(JSON.stringify(mappings, null, 2));
    }
}

scanManagerPDAs().catch(console.error);
