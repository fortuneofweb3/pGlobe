/**
 * Deep Registry PDA Structure Analysis
 * 
 * We know:
 * - Registry PDA = 1040 bytes
 * - Bytes 0-32 = Node pubkey (NOT owner)
 * 
 * Need to find where OWNER wallet is stored.
 * Let's look for 32-byte sequences that match Mainnet buyers.
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// Known mapping for verification
const KNOWN_NODE = '6PbJSbfG4pMneMoizZFNEfNkmBrL6frenKmDbqbBDcKq';
const KNOWN_BUYER = '4Ud8eU6dR6CGGAgrTJB2aVrsf3bce7eQyDZ1gRLTHNcn';

async function deepAnalysis() {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Deep Registry PDA Analysis ===\n');

    // Get Mainnet buyers
    const mainAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const buyerSet = new Set();
    for (const acc of mainAccounts) {
        buyerSet.add(new PublicKey(acc.account.data.slice(0, 32)).toBase58());
    }

    console.log(`Mainnet buyers: ${buyerSet.size}`);
    console.log(`Known buyer present: ${buyerSet.has(KNOWN_BUYER)}\n`);

    // Get the known node's Registry PDA
    const nodePubkey = new PublicKey(KNOWN_NODE);
    const [registryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), nodePubkey.toBuffer()],
        DEVNET_PROGRAM
    );

    const info = await devConn.getAccountInfo(registryPDA);
    if (!info) {
        console.log('Registry PDA not found for known node!');
        return;
    }

    console.log(`Registry PDA for known node: ${registryPDA.toBase58()}`);
    console.log(`Data length: ${info.data.length} bytes\n`);

    // Search for the buyer's pubkey anywhere in the data
    const buyerBuffer = new PublicKey(KNOWN_BUYER).toBuffer();
    const buyerHex = buyerBuffer.toString('hex');

    console.log(`Looking for buyer pubkey: ${KNOWN_BUYER.slice(0, 12)}...`);
    console.log(`Buyer hex: ${buyerHex.slice(0, 40)}...`);

    // Scan all 32-byte windows
    for (let offset = 0; offset <= info.data.length - 32; offset++) {
        const window = info.data.slice(offset, offset + 32);
        const windowHex = window.toString('hex');

        if (windowHex === buyerHex) {
            console.log(`\n✅ FOUND BUYER AT OFFSET ${offset}!`);
        }
    }

    // Also check if any 32-byte window is a Mainnet buyer
    console.log('\nSearching for ANY Mainnet buyer in registry data...');
    for (let offset = 0; offset <= info.data.length - 32; offset++) {
        const window = info.data.slice(offset, offset + 32);
        try {
            const pk = new PublicKey(window).toBase58();
            if (buyerSet.has(pk)) {
                console.log(`  BUYER FOUND at offset ${offset}: ${pk.slice(0, 12)}...`);
            }
        } catch { }
    }

    // Print structure at key offsets
    console.log('\n--- Registry PDA Structure Sample ---');
    const offsets = [0, 32, 40, 64, 96, 128, 160, 192, 224, 256, 1000];
    for (const off of offsets) {
        if (off + 32 <= info.data.length) {
            try {
                const pk = new PublicKey(info.data.slice(off, off + 32)).toBase58();
                console.log(`Offset ${off}: ${pk.slice(0, 20)}...`);
            } catch {
                console.log(`Offset ${off}: [invalid pubkey]`);
            }
        }
    }
}

deepAnalysis().catch(console.error);
