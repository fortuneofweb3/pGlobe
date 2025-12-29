/**
 * Deep Mainnet Account Analysis
 * 
 * The Mainnet purchase account is 48 bytes:
 * - Bytes 0-32: Buyer wallet (confirmed)
 * - Bytes 32-48: 16 bytes of... UNKNOWN
 * 
 * Hypothesis: Those 16 bytes might encode node reference:
 * - First 16 bytes of node pubkey?
 * - A hash of node pubkey?
 * - An index/counter?
 * - A PDA bump + something?
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function analyzeMainnetAccounts() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Deep Mainnet Purchase Account Analysis ===\n');

    // Get Mainnet accounts
    const accounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    console.log(`Found ${accounts.length} Mainnet purchase accounts.\n`);

    // Get Devnet nodes for comparison
    const indexInfo = await devConn.getAccountInfo(INDEX_ACCOUNT);
    const devnetNodes = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.push(pk.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.length} nodes.\n`);

    // Analyze first 10 accounts
    console.log('--- Analyzing first 10 Mainnet Purchase Accounts ---\n');

    for (let i = 0; i < Math.min(10, accounts.length); i++) {
        const acc = accounts[i];
        const data = acc.account.data;

        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        const remaining16 = data.slice(32, 48);

        console.log(`Account ${i + 1}: ${acc.pubkey.toBase58()}`);
        console.log(`  Buyer: ${buyer}`);
        console.log(`  Bytes 32-48 (hex): ${remaining16.toString('hex')}`);

        // Try to interpret the 16 bytes
        // As a u64 little-endian (counter?)
        const asU64 = remaining16.readBigUInt64LE(0);
        console.log(`  As u64 (LE): ${asU64}`);

        // Try matching first 16 bytes of any devnet node
        const first16Hex = remaining16.toString('hex');
        const matchingNode = devnetNodes.find(nodeId => {
            const nodeBytes = new PublicKey(nodeId).toBuffer();
            return nodeBytes.slice(0, 16).toString('hex') === first16Hex;
        });
        if (matchingNode) {
            console.log(`  ✅ MATCH! Node: ${matchingNode}`);
        }

        // Try if bytes 32-48 are last 16 bytes of a node pubkey
        const last16Match = devnetNodes.find(nodeId => {
            const nodeBytes = new PublicKey(nodeId).toBuffer();
            return nodeBytes.slice(16, 32).toString('hex') === first16Hex;
        });
        if (last16Match) {
            console.log(`  ✅ LAST 16 MATCH! Node: ${last16Match}`);
        }

        console.log('');
    }

    // Also check: does the PDA address itself encode the node?
    console.log('--- Checking if PDA address encodes node info ---\n');
    for (let i = 0; i < Math.min(5, accounts.length); i++) {
        const acc = accounts[i];
        const pdaAddr = acc.pubkey.toBase58();

        // Does any devnet node's first 16/last 16 bytes match the PDA?
        const pdaBytes = acc.pubkey.toBuffer();
        const pdaFirst16 = pdaBytes.slice(0, 16).toString('hex');
        const pdaLast16 = pdaBytes.slice(16, 32).toString('hex');

        const nodeMatchFirst = devnetNodes.find(n => new PublicKey(n).toBuffer().slice(0, 16).toString('hex') === pdaFirst16);
        const nodeMatchLast = devnetNodes.find(n => new PublicKey(n).toBuffer().slice(16, 32).toString('hex') === pdaLast16);

        if (nodeMatchFirst) console.log(`PDA ${i + 1} first16 matches node: ${nodeMatchFirst}`);
        if (nodeMatchLast) console.log(`PDA ${i + 1} last16 matches node: ${nodeMatchLast}`);
    }

    console.log('\n=== Analysis Complete ===');
}

analyzeMainnetAccounts().catch(console.error);
