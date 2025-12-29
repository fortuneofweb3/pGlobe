
import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

const OUTPUT_FILE = path.join(__dirname, 'data', 'node-wallet-mappings.json');

interface Mapping {
    nodeId: string;
    managerWallet: string;
    discoveredAt: string;
}

async function fullScan() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Load existing mappings if available
    let existingMappings: Mapping[] = [];
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            existingMappings = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Loaded ${existingMappings.length} existing mappings.`);
        }
    } catch { }

    const existingNodes = new Set(existingMappings.map(m => m.nodeId));

    // Get Mainnet wallets
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = mainnetAccounts.map(a =>
        new PublicKey(a.account.data.slice(0, 32)).toBase58()
    );
    console.log(`Mainnet has ${mainnetWallets.length} wallets.`);

    // Get Devnet nodes
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    // Find wallets with Devnet Manager PDAs
    console.log('Finding wallets with Devnet Manager PDAs...');
    const walletsWithDevnet: string[] = [];

    for (const wallet of mainnetWallets) {
        const [managerPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), new PublicKey(wallet).toBuffer()],
            DEVNET_PROGRAM
        );
        const info = await devnetConn.getAccountInfo(managerPDA);
        if (info && info.data.length === 34 && info.data[33] > 0) {
            walletsWithDevnet.push(wallet);
        }
    }
    console.log(`Found ${walletsWithDevnet.length} wallets with Devnet registrations.\n`);

    // Scan ALL wallets
    console.log('Scanning wallet Devnet transaction history (this may take a while)...\n');
    const newMappings: Mapping[] = [];
    let scannedCount = 0;

    for (const wallet of walletsWithDevnet) {
        scannedCount++;
        if (scannedCount % 10 === 0) {
            console.log(`  Progress: ${scannedCount}/${walletsWithDevnet.length} wallets scanned...`);
        }

        try {
            const walletPubkey = new PublicKey(wallet);
            const sigs = await devnetConn.getSignaturesForAddress(walletPubkey, { limit: 100 });

            for (const sig of sigs) {
                const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                if (!tx) continue;

                const involvesProgram = tx.transaction.message.accountKeys.some(
                    a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                );
                if (!involvesProgram) continue;

                const logs = tx.meta?.logMessages || [];
                const isRegister = logs.some(l => l.includes('egister') || l.includes('pNode'));
                if (!isRegister) continue;

                for (const acc of tx.transaction.message.accountKeys) {
                    const pubkey = acc.pubkey.toBase58();
                    if (devnetNodes.has(pubkey) && !existingNodes.has(pubkey)) {
                        newMappings.push({
                            nodeId: pubkey,
                            managerWallet: wallet,
                            discoveredAt: new Date().toISOString()
                        });
                        existingNodes.add(pubkey);
                        console.log(`  ✅ New: ${pubkey.slice(0, 8)}... -> ${wallet.slice(0, 8)}...`);
                        break;
                    }
                }
            }
        } catch (e) {
            // Skip errors
        }

        await new Promise(r => setTimeout(r, 200));
    }

    // Merge and save
    const allMappings = [...existingMappings, ...newMappings];

    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allMappings, null, 2));

    console.log(`\n========================================`);
    console.log(`Summary`);
    console.log(`========================================`);
    console.log(`Previously known: ${existingMappings.length}`);
    console.log(`Newly discovered: ${newMappings.length}`);
    console.log(`Total mappings: ${allMappings.length}`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
}

fullScan().catch(console.error);
