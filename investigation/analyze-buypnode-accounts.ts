/**
 * Deep dive into BuyPNode account structures
 * Looking for any data that could link to node pubkeys
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function deepAnalysis() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    // Get devnet nodes for cross-reference
    console.log('Fetching Devnet nodes...\n');
    const indexInfo = await devConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() !== '11111111111111111111111111111111') {
                devnetNodes.add(pk.toBase58());
            }
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes\n`);

    // Get 48-byte accounts (purchase records)
    console.log('Fetching 48-byte purchase accounts...\n');
    const purchaseAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    console.log(`Found ${purchaseAccounts.length} purchase accounts\n`);

    // Analyze structure of 48-byte accounts
    console.log('=== 48-byte Account Analysis ===\n');

    // Check if there's any correlation with devnet nodes
    let nodesInPurchaseAccounts = 0;
    const buyerToPurchase = new Map<string, { account: PublicKey, data: Buffer }[]>();

    for (const acc of purchaseAccounts) {
        const data = acc.account.data;

        // Extract potential pubkeys (0-32, 8-40, 16-48)
        const offsets = [0, 8, 16];
        for (const offset of offsets) {
            if (offset + 32 <= data.length) {
                try {
                    const potentialPubkey = new PublicKey(data.slice(offset, offset + 32));
                    const base58 = potentialPubkey.toBase58();
                    if (devnetNodes.has(base58)) {
                        console.log(`*** FOUND NODE IN PURCHASE ACCOUNT ***`);
                        console.log(`  Account: ${acc.pubkey.toBase58()}`);
                        console.log(`  Offset ${offset}: ${base58}`);
                        nodesInPurchaseAccounts++;
                    }
                } catch (e) { }
            }
        }

        // Build buyer mapping
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        if (!buyerToPurchase.has(buyer)) {
            buyerToPurchase.set(buyer, []);
        }
        buyerToPurchase.get(buyer)!.push({ account: acc.pubkey, data });
    }

    console.log(`\nNodes found in purchase account data: ${nodesInPurchaseAccounts}`);
    console.log(`Unique buyers: ${buyerToPurchase.size}\n`);

    // Show buyers with multiple purchases
    console.log('=== Buyers with Multiple Purchases ===\n');
    let multiPurchasersCount = 0;
    for (const [buyer, purchases] of buyerToPurchase.entries()) {
        if (purchases.length > 1) {
            multiPurchasersCount++;
            if (multiPurchasersCount <= 5) {
                console.log(`Buyer: ${buyer}`);
                console.log(`  Purchases: ${purchases.length}`);
                for (const p of purchases) {
                    // Show the non-buyer portion of the data (bytes 32-48)
                    const extraData = p.data.slice(32);
                    console.log(`    Account: ${p.account.toBase58()}`);
                    console.log(`    Extra data (bytes 32-48): ${extraData.toString('hex')}`);
                    // Try to interpret the 16 bytes after buyer pubkey
                    // Could be: timestamp, counter, era ID, etc.
                    const val1 = p.data.readBigUInt64LE(32);
                    const val2 = p.data.readBigUInt64LE(40);
                    console.log(`    As u64s: [${val1}, ${val2}]`);
                }
                console.log('');
            }
        }
    }
    console.log(`Total buyers with multiple purchases: ${multiPurchasersCount}\n`);

    // Now look at RegisterOwner transactions
    console.log('=== RegisterOwner Transaction Analysis ===\n');

    // Get more transaction history
    const sigs = await mainConn.getSignaturesForAddress(MAINNET_PROGRAM, { limit: 50 });

    let registerOwnerTxs = 0;
    for (const sig of sigs) {
        const tx = await mainConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) continue;

        const logs = tx.meta?.logMessages || [];
        const isRegisterOwner = logs.some(l => l.includes('RegisterOwner'));

        if (isRegisterOwner) {
            registerOwnerTxs++;
            if (registerOwnerTxs <= 3) {
                console.log(`TX: ${sig.signature}`);
                console.log(`  Signer: ${tx.transaction.message.accountKeys[0].pubkey.toBase58()}`);

                // Check the instruction data
                for (const instr of tx.transaction.message.instructions) {
                    if ('data' in instr && 'programId' in instr) {
                        const programId = instr.programId;
                        if (programId.toBase58() === MAINNET_PROGRAM.toBase58()) {
                            console.log(`  Instruction data length: ${(instr as any).data?.length || 'N/A'}`);
                        }
                    }
                }

                // What accounts are created/modified?
                console.log(`  Account changes:`);
                const accountKeys = tx.transaction.message.accountKeys;
                const postBalances = tx.meta?.postBalances || [];
                const preBalances = tx.meta?.preBalances || [];

                for (let i = 0; i < accountKeys.length; i++) {
                    const preBalance = preBalances[i];
                    const postBalance = postBalances[i];
                    if (preBalance !== postBalance) {
                        const acc = accountKeys[i];
                        console.log(`    ${acc.pubkey.toBase58()}: ${preBalance} -> ${postBalance}`);
                    }
                }
                console.log('');
            }
        }
    }
    console.log(`Total RegisterOwner transactions in last 50: ${registerOwnerTxs}\n`);

    // Check the 1280-byte accounts - might be a global state
    console.log('=== 1280-byte Account Analysis ===\n');
    const largeAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 1280 }]
    });

    console.log(`Found ${largeAccounts.length} accounts with 1280 bytes\n`);

    for (const acc of largeAccounts) {
        console.log(`Account: ${acc.pubkey.toBase58()}`);

        // This might be an index/registry - check for devnet nodes
        const data = acc.account.data;
        console.log(`  Checking for devnet node pubkeys...\n`);

        let foundInThis = 0;
        for (let offset = 0; offset + 32 <= data.length; offset++) {
            try {
                const potentialPubkey = new PublicKey(data.slice(offset, offset + 32));
                const base58 = potentialPubkey.toBase58();
                if (devnetNodes.has(base58)) {
                    console.log(`  ** DEVNET NODE at offset ${offset}: ${base58}`);
                    foundInThis++;
                }
            } catch (e) { }
        }
        console.log(`  Total devnet nodes found in this account: ${foundInThis}\n`);
    }
}

deepAnalysis().catch(console.error);
