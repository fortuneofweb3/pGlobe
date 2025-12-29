
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function fullScan() {
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
    console.log(`Mainnet has ${mainnetWallets.size} wallets.`);

    // Get all Devnet nodes
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const nodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(key);
        }
    }
    console.log(`Scanning ${nodes.length} Devnet nodes...\n`);

    // Scan all Registries
    const BATCH = 100;
    const matches: { node: string, wallet: string }[] = [];

    for (let i = 0; i < nodes.length; i += BATCH) {
        const batch = nodes.slice(i, i + BATCH);
        const pdas = batch.map(n => PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), n.toBuffer()],
            DEVNET_PROGRAM
        )[0]);

        const infos = await devnetConn.getMultipleAccountsInfo(pdas);

        for (let j = 0; j < infos.length; j++) {
            const info = infos[j];
            if (info && info.data.length >= 40) {
                const key8 = new PublicKey(info.data.slice(8, 40)).toBase58();
                if (mainnetWallets.has(key8)) {
                    matches.push({ node: batch[j].toBase58(), wallet: key8 });
                    console.log(`🎉 MATCH! Node: ${batch[j].toBase58().slice(0, 8)}...  Wallet: ${key8.slice(0, 8)}...`);
                }
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`Total Matches: ${matches.length}`);
    console.log(`========================================\n`);

    if (matches.length > 0) {
        console.log('Matched Node -> Mainnet Wallet Mappings:');
        for (const m of matches) {
            console.log(`  ${m.node} -> ${m.wallet}`);
        }
    } else {
        console.log('No direct link found between Devnet Registries and Mainnet Wallets.');
    }
}

fullScan().catch(console.error);
