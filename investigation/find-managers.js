const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function findAllManagers() {
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
    console.log('Scanning ALL nodes for Manager PDA...');

    let found = 0;

    // Batch processing
    const BATCH_SIZE = 50;

    for (let i = 0; i < pubkeys.length; i += BATCH_SIZE) {
        const batch = pubkeys.slice(i, i + BATCH_SIZE);

        // Process batch in parallel-ish (but ensure we don't kill RPC)
        const promises = batch.map(async (nodePubkey) => {
            const [managerAddress] = PublicKey.findProgramAddressSync(
                [Buffer.from('manager'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );
            const info = await connection.getAccountInfo(managerAddress);
            return { nodePubkey, managerAddress, info };
        });

        const results = await Promise.all(promises);

        for (const res of results) {
            if (res.info) {
                found++;
                // Extract authority
                let authority = 'unknown';
                if (res.info.data.length >= 32) {
                    authority = new PublicKey(res.info.data.slice(0, 32)).toBase58();
                }
                console.log(`[FOUND] Node: ${res.nodePubkey.toBase58()} | ManagerPDA: ${res.managerAddress.toBase58()} | Buyer: ${authority}`);
            }
        }

        // Log progress
        console.log(`Scanned ${Math.min(i + BATCH_SIZE, pubkeys.length)}/${pubkeys.length}... Found so far: ${found}`);
        await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    console.log(`Summary: Found ${found} Manager PDAs total.`);
}

findAllManagers().catch(console.error);
