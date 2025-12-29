
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function deriveAndMatch() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get all Mainnet wallets and their PDAs
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Map<string, string>(); // wallet -> mainnet PDA
    for (const acc of mainnetAccounts) {
        const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
        mainnetWallets.set(wallet, acc.pubkey.toBase58());
    }
    console.log(`Mainnet has ${mainnetWallets.size} wallets.\n`);

    // Get all Devnet Registries
    console.log('Fetching Devnet Registries...');
    const registries = await devnetConn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });
    console.log(`Found ${registries.length} Registries.\n`);

    // For each Registry, get key@8 and derive its Manager PDA
    // Then check if that Manager PDA exists and has a matching Mainnet wallet owner
    console.log('Matching Registry key@8 -> Manager PDA -> Mainnet wallet...\n');

    const nodeToMainnetWallet = new Map<string, string>();

    for (const reg of registries) {
        const nodeKey = new PublicKey(reg.account.data.slice(0, 32)).toBase58();
        const key8 = new PublicKey(reg.account.data.slice(8, 40));

        // Derive Manager PDA from key8
        const [managerPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), key8.toBuffer()],
            DEVNET_PROGRAM
        );

        // Check if this Manager PDA exists
        const managerInfo = await devnetConn.getAccountInfo(managerPDA);
        if (managerInfo && managerInfo.data.length === 34) {
            const managerOwner = new PublicKey(managerInfo.data.slice(0, 32)).toBase58();

            // Check if this owner is a Mainnet wallet
            if (mainnetWallets.has(managerOwner)) {
                nodeToMainnetWallet.set(nodeKey, managerOwner);
                console.log(`✅ Node: ${nodeKey.slice(0, 8)}... -> Mainnet Wallet: ${managerOwner.slice(0, 8)}...`);
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`Results`);
    console.log(`========================================`);
    console.log(`Nodes linked to Mainnet wallets: ${nodeToMainnetWallet.size}`);

    if (nodeToMainnetWallet.size > 0) {
        console.log(`\n--- JSON Mappings (first 20) ---`);
        const mappings = Array.from(nodeToMainnetWallet.entries()).slice(0, 20).map(([node, wallet]) => ({
            nodeId: node,
            managerWallet: wallet
        }));
        console.log(JSON.stringify(mappings, null, 2));
    }
}

deriveAndMatch().catch(console.error);
