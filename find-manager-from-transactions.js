/**
 * Find manager/owner from transaction history
 * 
 * When a node registers, the transaction includes the owner wallet as a key.
 * We can parse transaction history to find this.
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function findManagerFromTransactions(nodeIdStr) {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const nodeId = nodeIdStr || process.argv[2];

    if (!nodeId) {
        console.log('Usage: node find-manager-from-transactions.js <node-pubkey>');
        return;
    }

    console.log('=== Finding Manager from Transaction History ===');
    console.log('Node:', nodeId, '\n');

    const nodePubkey = new PublicKey(nodeId);

    // Method 1: Check transaction signatures for this node on Devnet
    console.log('--- Method 1: Node Transaction History (Devnet) ---');
    try {
        const sigs = await devConn.getSignaturesForAddress(nodePubkey, { limit: 10 });
        console.log(`Found ${sigs.length} transactions for node on Devnet`);

        for (const sig of sigs) {
            console.log(`\nTransaction: ${sig.signature.slice(0, 20)}...`);
            const tx = await devConn.getTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (tx) {
                // Look at account keys
                const keys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys;
                console.log('  Account keys in transaction:');
                for (let i = 0; i < Math.min(5, keys.length); i++) {
                    console.log(`    [${i}] ${keys[i].toBase58()}`);
                }

                // Check if any key matches Mainnet buyers
                // Could also check derived Manager PDA to identify owner
            }
        }
    } catch (e) {
        console.log('Error fetching Devnet transactions:', e.message);
    }

    // Method 2: Check Mainnet for transactions involving this node
    console.log('\n--- Method 2: Node Transaction History (Mainnet) ---');
    try {
        const mainSigs = await mainConn.getSignaturesForAddress(nodePubkey, { limit: 10 });
        console.log(`Found ${mainSigs.length} transactions for node on Mainnet`);

        for (const sig of mainSigs) {
            console.log(`\nTransaction: ${sig.signature.slice(0, 20)}...`);
            const tx = await mainConn.getTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (tx) {
                const keys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys;
                console.log('  Account keys in transaction:');
                for (let i = 0; i < Math.min(5, keys.length); i++) {
                    console.log(`    [${i}] ${keys[i].toBase58()}`);
                }
            }
        }
    } catch (e) {
        console.log('Error fetching Mainnet transactions:', e.message);
    }

    // Method 3: Scan ALL Mainnet buyPnode accounts for this node in ANY position
    console.log('\n--- Method 3: Deep Scan Mainnet buyPnode Accounts ---');
    try {
        // Get all buyPnode accounts
        const accounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM);
        console.log(`Scanning ${accounts.length} buyPnode accounts...`);

        const nodeBuffer = nodePubkey.toBuffer();

        for (const acc of accounts) {
            const data = acc.account.data;
            // The 48-byte accounts store: buyer (32) + ?? (16)
            // Maybe node is somewhere else

            // Also check if account PDA is derived from this node
            const [expectedPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('license'), nodePubkey.toBuffer()],
                MAINNET_PROGRAM
            );

            if (acc.pubkey.equals(expectedPDA)) {
                console.log('\n✅ Found License PDA for this node!');
                console.log('  PDA:', acc.pubkey.toBase58());
                console.log('  Data size:', data.length);

                // Try to extract buyer
                if (data.length >= 32) {
                    const possibleBuyer = new PublicKey(data.slice(0, 32)).toBase58();
                    console.log('  Buyer (offset 0):', possibleBuyer);
                }
            }

            // Alternative PDA derivations to try
            const seedsToTry = [
                ['pnode', nodePubkey.toBuffer()],
                ['node', nodePubkey.toBuffer()],
                ['purchase', nodePubkey.toBuffer()],
            ];

            for (const seeds of seedsToTry) {
                try {
                    const [testPDA] = PublicKey.findProgramAddressSync(seeds, MAINNET_PROGRAM);
                    if (acc.pubkey.equals(testPDA)) {
                        console.log(`\n✅ Found PDA with seeds [${seeds[0]}]!`);
                        console.log('  Data size:', data.length);
                        if (data.length >= 32) {
                            console.log('  First 32 bytes:', new PublicKey(data.slice(0, 32)).toBase58());
                        }
                    }
                } catch { }
            }
        }
    } catch (e) {
        console.log('Error scanning Mainnet accounts:', e.message);
    }

    // Method 4: Check if we can derive a Manager PDA from the node somehow
    console.log('\n--- Method 4: Check Manager PDA Derivations ---');
    try {
        // Get all Manager PDAs on Devnet (size 34)
        const managerAccounts = await devConn.getProgramAccounts(DEVNET_PROGRAM, {
            filters: [{ dataSize: 34 }]
        });
        console.log(`Found ${managerAccounts.length} Manager PDAs on Devnet`);

        // For each, check the owner and see if any transaction links to our node
        // This is expensive but thorough
        console.log('Checking if any Manager PDA owner has this node registered...');

        // Actually, let's try reverse: check all registries and see if this node is there
        const registries = await devConn.getProgramAccounts(DEVNET_PROGRAM, {
            filters: [{ dataSize: 1040 }]
        });
        console.log(`Found ${registries.length} Registry PDAs`);

        for (const reg of registries) {
            const storedNode = new PublicKey(reg.account.data.slice(0, 32)).toBase58();
            if (storedNode === nodeId) {
                console.log('\n✅ Found Registry containing this node!');
                console.log('  Registry PDA:', reg.pubkey.toBase58());

                // Extract buyer from offset 42
                const buyer = new PublicKey(reg.account.data.slice(42, 74)).toBase58();
                console.log('  Buyer/Manager at offset 42:', buyer);
                return buyer;
            }
        }
    } catch (e) {
        console.log('Error checking Manager PDAs:', e.message);
    }

    console.log('\n=== Summary ===');
    console.log('Could not find a manager for this node through any method.');
}

findManagerFromTransactions().catch(console.error);
