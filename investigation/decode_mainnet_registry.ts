
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function decodeAll() {
    const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
    const devnetConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('Fetching all Mainnet program accounts (size 48)...');
    const accounts = await mainnetConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    console.log(`Found ${accounts.length} accounts.\n`);

    // Decode each and check if wallet exists on Devnet as a Node
    console.log('Fetching Devnet nodes...');
    const indexInfo = await devnetConn.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    let crossMatches = 0;

    for (const acc of accounts) {
        const wallet = new PublicKey(acc.account.data.slice(0, 32)).toBase58();
        const metadata = acc.account.data.slice(32, 48).toString('hex');

        // Check if this Mainnet wallet is also a Devnet node
        if (devnetNodes.has(wallet)) {
            crossMatches++;
            console.log(`✅ CROSS-MATCH!`);
            console.log(`   Mainnet PDA: ${acc.pubkey.toBase58()}`);
            console.log(`   Wallet/Node?: ${wallet}`);
            console.log(`   Metadata: ${metadata}`);
        }
    }

    console.log(`\nTotal cross-chain matches: ${crossMatches}`);

    // Check the reverse: can we derive the Mainnet PDA from the wallet?
    console.log('\nTrying to derive PDAs...');
    for (const acc of accounts.slice(0, 3)) {
        const wallet = new PublicKey(acc.account.data.slice(0, 32));

        // Try ['registry', wallet]
        const [pda1] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), wallet.toBuffer()],
            MAINNET_PROGRAM
        );
        console.log(`Wallet: ${wallet.toBase58()}`);
        console.log(`   Actual PDA: ${acc.pubkey.toBase58()}`);
        console.log(`   Derived ['registry', wallet]: ${pda1.toBase58()}`);
        console.log(`   Match: ${pda1.equals(acc.pubkey)}`);

        // Try ['pnode', wallet]
        const [pda2] = PublicKey.findProgramAddressSync(
            [Buffer.from('pnode'), wallet.toBuffer()],
            MAINNET_PROGRAM
        );
        console.log(`   Derived ['pnode', wallet]: ${pda2.toBase58()}`);
        console.log(`   Match: ${pda2.equals(acc.pubkey)}`);

        // Try just [wallet]
        const [pda3] = PublicKey.findProgramAddressSync(
            [wallet.toBuffer()],
            MAINNET_PROGRAM
        );
        console.log(`   Derived [wallet]: ${pda3.toBase58()}`);
        console.log(`   Match: ${pda3.equals(acc.pubkey)}\n`);
    }
}

decodeAll().catch(console.error);
