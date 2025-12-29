const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
// Assuming same program ID on Mainnet? Or is it different?
// Usually Program IDs are consistent if deployed to same address.

const INDEX_ACCOUNT_DEVNET = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

async function checkManagerPDAs() {
    const devConnection = new Connection(DEVNET_RPC, 'confirmed');
    const mainConnection = new Connection(MAINNET_RPC, 'confirmed');

    console.log('Fetching index from Devnet...');
    const accountInfo = await devConnection.getAccountInfo(INDEX_ACCOUNT_DEVNET);
    if (!accountInfo) throw new Error('Index not found');

    const pubkeys = [];
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    for (let i = 0; i < accountInfo.data.length; i += 32) {
        if (i + 32 > accountInfo.data.length) break;
        const pk = new PublicKey(accountInfo.data.slice(i, i + 32));
        if (!pk.equals(DEFAULT_PUBKEY)) pubkeys.push(pk);
    }

    console.log(`Found ${pubkeys.length} nodes in Devnet index.`);

    let foundMainnet = 0;
    let missingMainnet = 0;

    // Check first 20 on Mainnet
    console.log('Checking first 20 nodes for Manager PDA on MAINNET...');

    for (const nodePubkey of pubkeys.slice(0, 20)) {
        const [managerAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), nodePubkey.toBuffer()],
            PROGRAM_ID
        );

        // Check if account exists on Mainnet
        const info = await mainConnection.getAccountInfo(managerAddress);
        if (info) {
            foundMainnet++;
            console.log(`[MAINNET FOUND] Node ${nodePubkey.toBase58()} -> Manager ${managerAddress.toBase58()} (Len: ${info.data.length})`);
        } else {
            missingMainnet++;
            // console.log(`[MISSING] Node ${nodePubkey.toBase58()}`);
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Summary (Sample 20): Mainnet Found ${foundMainnet}, Missing ${missingMainnet}`);
}

checkManagerPDAs().catch(console.error);
