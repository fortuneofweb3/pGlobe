
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// Also get all Mainnet wallets for comparison
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function inspectRegistry() {
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');

    // Get Mainnet wallets
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Mainnet has ${mainnetWallets.size} wallets.\n`);

    // Get first 5 Devnet nodes and inspect their Registries
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const nodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo!.data.length && nodes.length < 10; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(key);
        }
    }

    console.log('Inspecting first 10 Devnet Registries:\n');

    for (const node of nodes) {
        const [registryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), node.toBuffer()],
            DEVNET_PROGRAM
        );

        const info = await devnetConn.getAccountInfo(registryPDA);
        if (!info) {
            console.log(`Node ${node.toBase58().slice(0, 8)}...: No Registry`);
            continue;
        }

        console.log(`Node: ${node.toBase58()}`);
        console.log(`  Registry: ${registryPDA.toBase58()}`);
        console.log(`  Size: ${info.data.length}`);

        // Extract possible keys at various offsets
        const key0 = new PublicKey(info.data.slice(0, 32)).toBase58();
        const key8 = new PublicKey(info.data.slice(8, 40)).toBase58();
        const key32 = info.data.length >= 64 ? new PublicKey(info.data.slice(32, 64)).toBase58() : 'N/A';

        console.log(`  Key@0: ${key0}`);
        console.log(`  Key@8: ${key8}`);
        console.log(`  Key@32: ${key32}`);

        // Check if any key is a Mainnet wallet
        const isMainnet0 = mainnetWallets.has(key0);
        const isMainnet8 = mainnetWallets.has(key8);
        const isMainnet32 = mainnetWallets.has(key32);

        if (isMainnet0 || isMainnet8 || isMainnet32) {
            console.log(`  🎯 MAINNET WALLET FOUND!`);
            if (isMainnet0) console.log(`     Key@0 is Mainnet wallet!`);
            if (isMainnet8) console.log(`     Key@8 is Mainnet wallet!`);
            if (isMainnet32) console.log(`     Key@32 is Mainnet wallet!`);
        }

        console.log('');
    }
}

inspectRegistry().catch(console.error);
