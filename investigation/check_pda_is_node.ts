
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function crossCheck() {
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');

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
    console.log(`Devnet has ${devnetNodes.size} nodes.`);

    // Get Mainnet PDAs
    console.log('Fetching Mainnet PDAs (48-byte accounts)...');
    const mainnetAccounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    console.log(`Mainnet has ${mainnetAccounts.length} PDAs.`);

    // Check if any Mainnet PDA address is a Devnet Node
    console.log('\nChecking if Mainnet PDA addresses are Devnet Nodes...');
    let matchCount = 0;
    for (const acc of mainnetAccounts) {
        if (devnetNodes.has(acc.pubkey.toBase58())) {
            matchCount++;
            const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
            console.log(`✅ MATCH!`);
            console.log(`   PDA (Node?): ${acc.pubkey.toBase58()}`);
            console.log(`   Wallet@0: ${wallet}`);
        }
    }
    console.log(`\nTotal matches: ${matchCount}`);

    // Output some unmatched for manual inspection
    if (matchCount === 0) {
        console.log('\nNo automatic matches. Outputting first 5 Mainnet PDAs for manual check:');
        for (let i = 0; i < 5 && i < mainnetAccounts.length; i++) {
            const acc = mainnetAccounts[i];
            const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
            console.log(`   PDA: ${acc.pubkey.toBase58()}`);
            console.log(`   Wallet: ${wallet}`);
        }
    }
}

crossCheck().catch(console.error);
