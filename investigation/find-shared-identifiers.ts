/**
 * Look for shared unique identifiers between Mainnet purchase accounts
 * and Devnet registry accounts - something other than the node pubkey
 * 
 * Hypothesis: There might be an index or unique key that links them
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function findSharedIdentifiers() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Looking for Shared Identifiers ===\n');

    // Get all Mainnet 48-byte purchase accounts
    console.log('Fetching Mainnet purchase accounts...\n');
    const purchaseAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    console.log(`Found ${purchaseAccounts.length} purchase accounts\n`);

    // Analyze the structure of purchase accounts
    console.log('=== Mainnet Purchase Account Structure ===\n');

    // The structure is: 32 bytes buyer + 16 bytes extra data
    const purchaseData: { buyer: string, extra: Buffer, val1: bigint, val2: bigint, accountPda: string }[] = [];

    for (const acc of purchaseAccounts.slice(0, 10)) {
        const data = acc.account.data;
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        const extra = data.slice(32, 48);
        const val1 = data.readBigUInt64LE(32);
        const val2 = data.readBigUInt64LE(40);

        purchaseData.push({ buyer, extra, val1, val2, accountPda: acc.pubkey.toBase58() });

        console.log(`Account: ${acc.pubkey.toBase58()}`);
        console.log(`  Buyer: ${buyer}`);
        console.log(`  Extra bytes (hex): ${extra.toString('hex')}`);
        console.log(`  As u64s: [${val1}, ${val2}]`);
        console.log(`  val1 as date: ${new Date(Number(val1) * 1000).toISOString()}`);
        console.log('');
    }

    // Get devnet nodes and their registry data
    console.log('\n=== Devnet Registry Account Structure ===\n');

    const indexInfo = await devConn.getAccountInfo(DEVNET_INDEX);
    const allNodes: string[] = [];
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() !== '11111111111111111111111111111111') {
                allNodes.push(pk.toBase58());
            }
        }
    }

    console.log(`Total nodes: ${allNodes.length}\n`);

    // Get registry data for registered nodes
    const registryData: {
        nodePubkey: string,
        registrarWallet: string,
        managerWallet: string,
        price: bigint,
        extraData: string[]
    }[] = [];

    for (const nodeId of allNodes.slice(0, 20)) {
        const nodePk = new PublicKey(nodeId);
        const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePk.toBuffer()],
            DEVNET_PROGRAM
        );

        const info = await devConn.getAccountInfo(registryPda);
        if (info) {
            const data = info.data;

            // Parse what we know
            const registrarWallet = data.length >= 40 ? new PublicKey(data.slice(8, 40)).toBase58() : 'N/A';
            const price = data.length >= 42 ? data.readBigUInt64LE(34) : BigInt(0);
            const managerWallet = data.length >= 74 ? new PublicKey(data.slice(42, 74)).toBase58() : 'N/A';

            // Look for any u64 values in the registry
            const u64Values: string[] = [];
            for (let offset = 0; offset + 8 <= Math.min(data.length, 100); offset += 8) {
                const val = data.readBigUInt64LE(offset);
                if (val > 0 && val < BigInt(2 ** 53)) {
                    u64Values.push(`offset ${offset}: ${val}`);
                }
            }

            registryData.push({
                nodePubkey: nodeId,
                registrarWallet,
                managerWallet,
                price,
                extraData: u64Values
            });

            console.log(`Node: ${nodeId}`);
            console.log(`  Registrar: ${registrarWallet}`);
            console.log(`  Manager: ${managerWallet}`);
            console.log(`  Price: ${Number(price) / 1e9} XAND`);
            console.log(`  U64 values in first 100 bytes:`);
            for (const v of u64Values.slice(0, 5)) {
                console.log(`    ${v}`);
            }
            console.log('');
        }

        await new Promise(r => setTimeout(r, 50));
    }

    // Now look for correlations
    console.log('\n=== Looking for Correlations ===\n');

    // Build a set of all interesting values from purchases
    const purchaseValues = new Set<string>();
    for (const p of purchaseData) {
        purchaseValues.add(p.val1.toString());
        purchaseValues.add(p.val2.toString());
        purchaseValues.add(p.extra.toString('hex'));
    }

    console.log(`Unique values in purchase accounts: ${purchaseValues.size}`);

    // Check if any registry values match
    let matches = 0;
    for (const r of registryData) {
        for (const v of r.extraData) {
            const val = v.split(': ')[1];
            if (purchaseValues.has(val)) {
                console.log(`MATCH FOUND! Registry ${r.nodePubkey} has value ${val}`);
                matches++;
            }
        }
    }

    console.log(`\nTotal matches found: ${matches}`);

    // Try a different approach: check for common manager wallets
    console.log('\n=== Checking Manager Wallet Overlap ===\n');

    const purchaseBuyers = new Set(purchaseData.map(p => p.buyer));

    // Get all purchase buyers
    const allBuyers = new Set<string>();
    for (const acc of purchaseAccounts) {
        allBuyers.add(new PublicKey(acc.account.data.slice(0, 32)).toBase58());
    }
    console.log(`Total Mainnet buyers: ${allBuyers.size}`);

    // Check how many registry manager wallets are Mainnet buyers
    let buyerManagers = 0;
    for (const r of registryData) {
        if (allBuyers.has(r.managerWallet)) {
            buyerManagers++;
            console.log(`  Manager ${r.managerWallet} is a Mainnet buyer (Node: ${r.nodePubkey.slice(0, 8)}...)`);
        }
    }
    console.log(`\nRegistry managers who are also Mainnet buyers: ${buyerManagers}/${registryData.length}`);
}

findSharedIdentifiers().catch(console.error);
