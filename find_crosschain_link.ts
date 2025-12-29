
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function findLink() {
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');

    // 1. Get all Mainnet Wallets
    console.log('Fetching Mainnet wallets...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    const mainnetWallets = new Set(
        mainnetAccounts.map(a => new PublicKey(a.account.data.slice(0, 32)).toBase58())
    );
    console.log(`Mainnet has ${mainnetWallets.size} unique wallets.`);

    // 2. Get all Devnet Nodes and their Owners
    console.log('Fetching Devnet nodes and owners...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.push(key);
        }
    }
    console.log(`Devnet has ${devnetNodes.length} nodes.`);

    // 3. Scan Devnet Registries for Owners
    console.log('Scanning Devnet registries...');
    const devnetOwners = new Map<string, string>(); // Owner -> Node
    const BATCH = 100;

    for (let i = 0; i < devnetNodes.length; i += BATCH) {
        const batch = devnetNodes.slice(i, i + BATCH);
        const pdas = batch.map(n => PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), n.toBuffer()],
            DEVNET_PROGRAM
        )[0]);

        const infos = await devnetConn.getMultipleAccountsInfo(pdas);

        infos.forEach((info, idx) => {
            if (info && info.data.length >= 40) {
                const owner = new PublicKey(info.data.slice(8, 40)).toBase58();
                devnetOwners.set(owner, batch[idx].toBase58());
            }
        });
    }
    console.log(`Found ${devnetOwners.size} Devnet owners.`);

    // 4. Find intersection
    console.log('\nLooking for Devnet Owners that are also Mainnet Wallets...');
    let matches = 0;

    for (const [owner, node] of devnetOwners) {
        if (mainnetWallets.has(owner)) {
            matches++;
            console.log(`✅ MATCH!`);
            console.log(`   Devnet Node: ${node}`);
            console.log(`   Owner/Mainnet Wallet: ${owner}`);
        }
    }

    console.log(`\nTotal matches: ${matches}`);
}

findLink().catch(console.error);
