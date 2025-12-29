const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function checkManagerPDAs() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log('Fetching index...');
    const accountInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (!accountInfo) throw new Error('Index not found');

    const pubkeys = [];
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    for (let i = 0; i < accountInfo.data.length; i += 32) {
        if (i + 32 > accountInfo.data.length) break;
        const pk = new PublicKey(accountInfo.data.slice(i, i + 32));
        if (!pk.equals(DEFAULT_PUBKEY)) pubkeys.push(pk);
    }

    console.log(`Found ${pubkeys.length} nodes in index.`);

    let foundManager = 0;
    let missingManager = 0;

    // Check first 50 and report
    console.log('Checking first 50 nodes for Manager PDA...');

    for (const nodePubkey of pubkeys.slice(0, 50)) {
        const [managerAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), nodePubkey.toBuffer()],
            DEVNET_PROGRAM
        );

        // Check if account exists
        const info = await connection.getAccountInfo(managerAddress);
        if (info) {
            foundManager++;
            console.log(`[FOUND] Node ${nodePubkey.toBase58()} -> Manager ${managerAddress.toBase58()} (Len: ${info.data.length})`);
        } else {
            missingManager++;
            // console.log(`[MISSING] Node ${nodePubkey.toBase58()} -> Manager ${managerAddress.toBase58()}`);
        }
    }

    console.log(`Summary (Sample 50): Found ${foundManager}, Missing ${missingManager}`);
}

checkManagerPDAs().catch(console.error);
