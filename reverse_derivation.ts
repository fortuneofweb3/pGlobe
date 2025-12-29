
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function reverseDerivation() {
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
    console.log(`Mainnet has ${mainnetWallets.length} wallets.\n`);

    // For each Mainnet wallet, derive Manager PDA on Devnet
    console.log('Deriving Manager PDAs for Mainnet wallets on Devnet...');
    const walletToManagerPDA = new Map<string, { pda: string, registered: number }>();

    for (const wallet of mainnetWallets) {
        const walletPubkey = new PublicKey(wallet);
        const [managerPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), walletPubkey.toBuffer()],
            DEVNET_PROGRAM
        );

        const info = await devnetConn.getAccountInfo(managerPDA);
        if (info && info.data.length === 34) {
            const registered = info.data[33];
            if (registered > 0) {
                walletToManagerPDA.set(wallet, {
                    pda: managerPDA.toBase58(),
                    registered
                });
            }
        }
    }

    console.log(`Found ${walletToManagerPDA.size} Mainnet wallets with active Manager PDAs on Devnet.\n`);

    if (walletToManagerPDA.size === 0) {
        console.log('No matches found. The Devnet and Mainnet systems are completely separate.');
        return;
    }

    // Now we need to find which Nodes belong to these Managers
    // The Manager PDA only has counts, not node IDs
    // We need to scan registration transactions to find the signer

    console.log('--- Mainnet Wallets with Devnet Manager PDAs ---');
    for (const [wallet, data] of walletToManagerPDA) {
        console.log(`  Wallet: ${wallet}`);
        console.log(`    Manager PDA: ${data.pda}`);
        console.log(`    Registered pNodes: ${data.registered}`);
    }

    // Output wallets for further processing
    console.log('\n--- Wallets to scan for registration transactions ---');
    const walletsArray = Array.from(walletToManagerPDA.keys());
    console.log(JSON.stringify(walletsArray, null, 2));
}

reverseDerivation().catch(console.error);
