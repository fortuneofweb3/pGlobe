
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function scanWalletHistory() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

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

    // Find wallets that have Manager PDAs on Devnet
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

    // For first 20 wallets, scan their Devnet transaction history
    console.log('Scanning wallet Devnet transaction history...\n');
    const nodeToWallet = new Map<string, string>();

    for (const wallet of walletsWithDevnet.slice(0, 30)) {
        try {
            const walletPubkey = new PublicKey(wallet);
            const sigs = await devnetConn.getSignaturesForAddress(walletPubkey, { limit: 50 });

            for (const sig of sigs) {
                const tx = await devnetConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
                if (!tx) continue;

                // Check if this involves the Devnet Program
                const involvesProgram = tx.transaction.message.accountKeys.some(
                    a => a.pubkey.toBase58() === DEVNET_PROGRAM.toBase58()
                );
                if (!involvesProgram) continue;

                // Check logs for registration
                const logs = tx.meta?.logMessages || [];
                const isRegister = logs.some(l => l.includes('egister') || l.includes('pNode'));
                if (!isRegister) continue;

                // Find which account is a node
                for (const acc of tx.transaction.message.accountKeys) {
                    const pubkey = acc.pubkey.toBase58();
                    if (devnetNodes.has(pubkey)) {
                        if (!nodeToWallet.has(pubkey)) {
                            nodeToWallet.set(pubkey, wallet);
                            console.log(`✅ Node: ${pubkey.slice(0, 8)}... -> Wallet: ${wallet.slice(0, 8)}...`);
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            // Skip errors
        }

        // Small delay
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n========================================`);
    console.log(`Results`);
    console.log(`========================================`);
    console.log(`Nodes linked to Mainnet wallets: ${nodeToWallet.size}`);

    if (nodeToWallet.size > 0) {
        console.log('\n--- JSON Output (for storage) ---');
        const mappings = Array.from(nodeToWallet.entries()).map(([node, wallet]) => ({
            nodeId: node,
            managerWallet: wallet
        }));
        console.log(JSON.stringify(mappings, null, 2));
    }
}

scanWalletHistory().catch(console.error);
