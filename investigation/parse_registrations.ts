
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// Mainnet wallets for verification
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function parseRegistrations() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get Mainnet wallets for verification
    console.log('Fetching Mainnet wallets for verification...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Loaded ${mainnetWallets.size} Mainnet wallets.\n`);

    // Get Devnet nodes
    console.log('Fetching Devnet nodes...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Loaded ${devnetNodes.size} Devnet nodes.\n`);

    // Get all signatures for the program (limited to recent ~1000)
    console.log('Fetching program transaction signatures...');
    let allSignatures: { signature: string }[] = [];
    let before: string | undefined = undefined;

    for (let batch = 0; batch < 5; batch++) { // 5 batches of 1000 = 5000 txs max
        const sigs = await devnetConn.getSignaturesForAddress(DEVNET_PROGRAM, {
            limit: 1000,
            before
        });
        if (sigs.length === 0) break;
        allSignatures = allSignatures.concat(sigs);
        before = sigs[sigs.length - 1].signature;
        console.log(`  Fetched batch ${batch + 1}: ${sigs.length} signatures`);

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`Total signatures: ${allSignatures.length}\n`);

    // Parse transactions to find registrations
    console.log('Parsing transactions for registerPNode...');
    const nodeToWallet = new Map<string, string>();
    const walletToNodes = new Map<string, string[]>();
    let registrationCount = 0;
    let processedCount = 0;

    for (const sig of allSignatures) {
        try {
            const tx = await devnetConn.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
            });
            if (!tx) continue;

            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`  Processed ${processedCount}/${allSignatures.length} transactions...`);
            }

            // Check if this tx involves registerPNode (look for program invocation)
            const logs = tx.meta?.logMessages || [];
            const isRegister = logs.some(l =>
                l.includes('register') || l.includes('Register') || l.includes('pNode')
            );

            if (!isRegister) continue;

            // Get signer (first account that is signer)
            const signerKey = tx.transaction.message.accountKeys.find(a => a.signer);
            if (!signerKey) continue;
            const signer = signerKey.pubkey.toBase58();

            // Find which account is a Devnet Node
            for (const acc of tx.transaction.message.accountKeys) {
                const pubkey = acc.pubkey.toBase58();
                if (devnetNodes.has(pubkey)) {
                    // Found a registration: signer -> node
                    nodeToWallet.set(pubkey, signer);

                    if (!walletToNodes.has(signer)) {
                        walletToNodes.set(signer, []);
                    }
                    walletToNodes.get(signer)!.push(pubkey);

                    registrationCount++;

                    // Check if signer is a Mainnet wallet
                    const isMainnet = mainnetWallets.has(signer);
                    console.log(`  ✅ Registration found!`);
                    console.log(`     Node: ${pubkey.slice(0, 8)}...`);
                    console.log(`     Signer: ${signer.slice(0, 8)}... ${isMainnet ? '(Mainnet ✓)' : ''}`);
                    break;
                }
            }

            // Rate limit
            if (processedCount % 10 === 0) {
                await new Promise(r => setTimeout(r, 200));
            }

        } catch (e) {
            // Skip errors
        }
    }

    console.log(`\n========================================`);
    console.log(`Registration Summary`);
    console.log(`========================================`);
    console.log(`Total Registrations Found: ${registrationCount}`);
    console.log(`Unique Nodes Linked: ${nodeToWallet.size}`);
    console.log(`Unique Wallets: ${walletToNodes.size}`);

    // Count Mainnet matches
    let mainnetMatches = 0;
    for (const wallet of walletToNodes.keys()) {
        if (mainnetWallets.has(wallet)) {
            mainnetMatches++;
        }
    }
    console.log(`Wallets also on Mainnet: ${mainnetMatches}`);

    console.log(`\n--- Sample Mappings (first 10) ---`);
    let i = 0;
    for (const [node, wallet] of nodeToWallet) {
        if (i >= 10) break;
        console.log(`${node} -> ${wallet}`);
        i++;
    }

    // Output as JSON for storage
    console.log(`\n--- JSON Output (for MongoDB) ---`);
    const mappings = Array.from(nodeToWallet.entries()).map(([node, wallet]) => ({
        nodeId: node,
        managerWallet: wallet,
        isMainnetVerified: mainnetWallets.has(wallet)
    }));
    console.log(JSON.stringify(mappings.slice(0, 5), null, 2));
}

parseRegistrations().catch(console.error);
