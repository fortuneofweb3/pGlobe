
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

interface PurchaseEvent {
    wallet: string;
    timestamp: number;
    signature: string;
}

interface RegistrationEvent {
    node: string;
    signer: string;
    timestamp: number;
    signature: string;
}

async function timeCorrelation() {
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');

    // 1. Fetch all BuypNode transactions from Mainnet
    console.log('Fetching Mainnet BuypNode transactions...');
    const mainnetSigs = await mainnetConn.getSignaturesForAddress(MAINNET_PROGRAM, { limit: 1000 });
    console.log(`Found ${mainnetSigs.length} Mainnet program transactions.\n`);

    const purchases: PurchaseEvent[] = [];

    for (const sig of mainnetSigs.slice(0, 50)) { // Limit for speed
        try {
            const tx = await mainnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx || !tx.blockTime) continue;

            const logs = tx.meta?.logMessages || [];
            const isBuy = logs.some(l => l.includes('BuypNode') || l.includes('PNode Buy'));
            if (!isBuy) continue;

            const signer = tx.transaction.message.accountKeys.find(a => a.signer);
            if (!signer) continue;

            purchases.push({
                wallet: signer.pubkey.toBase58(),
                timestamp: tx.blockTime,
                signature: sig.signature
            });
        } catch { }
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Found ${purchases.length} BuypNode transactions.\n`);

    // 2. Get all Devnet nodes
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    // 3. Fetch Devnet registration transactions
    console.log('Fetching Devnet registration transactions...');
    const devnetSigs = await devnetConn.getSignaturesForAddress(DEVNET_PROGRAM, { limit: 1000 });
    console.log(`Found ${devnetSigs.length} Devnet program transactions.\n`);

    const registrations: RegistrationEvent[] = [];

    for (const sig of devnetSigs) {
        try {
            const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx || !tx.blockTime) continue;

            const logs = tx.meta?.logMessages || [];
            const isRegister = logs.some(l => l.includes('register') || l.includes('Register'));
            if (!isRegister) continue;

            const signer = tx.transaction.message.accountKeys.find(a => a.signer);
            if (!signer) continue;

            // Find which account is a node
            for (const acc of tx.transaction.message.accountKeys) {
                const pubkey = acc.pubkey.toBase58();
                if (devnetNodes.has(pubkey)) {
                    registrations.push({
                        node: pubkey,
                        signer: signer.pubkey.toBase58(),
                        timestamp: tx.blockTime,
                        signature: sig.signature
                    });
                    break;
                }
            }
        } catch { }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`Found ${registrations.length} registration transactions.\n`);

    // 4. Correlate by time: For each Mainnet purchase, find Devnet registration within 7 days
    console.log('Correlating by time (±7 days window)...\n');
    const WINDOW = 7 * 24 * 60 * 60; // 7 days in seconds

    const matches: { node: string, wallet: string, purchaseTime: string, regTime: string }[] = [];

    for (const purchase of purchases) {
        for (const reg of registrations) {
            // Same wallet might have signed both? Check wallet match
            // OR time-based: if registration is within window of purchase
            const timeDiff = Math.abs(purchase.timestamp - reg.timestamp);

            if (timeDiff <= WINDOW) {
                // Check if wallet matches (user might use same wallet on both chains)
                if (purchase.wallet === reg.signer) {
                    matches.push({
                        node: reg.node,
                        wallet: purchase.wallet,
                        purchaseTime: new Date(purchase.timestamp * 1000).toISOString(),
                        regTime: new Date(reg.timestamp * 1000).toISOString()
                    });
                }
            }
        }
    }

    console.log(`========================================`);
    console.log(`Time Correlation Results`);
    console.log(`========================================`);
    console.log(`Matches found: ${matches.length}`);

    if (matches.length > 0) {
        console.log('\n--- Matched Node -> Wallet Mappings ---');
        for (const m of matches) {
            console.log(`  Node: ${m.node}`);
            console.log(`  Wallet: ${m.wallet}`);
            console.log(`  Purchase: ${m.purchaseTime}`);
            console.log(`  Registration: ${m.regTime}\n`);
        }

        console.log('\n--- JSON Output ---');
        console.log(JSON.stringify(matches, null, 2));
    }
}

timeCorrelation().catch(console.error);
