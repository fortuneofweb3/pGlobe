
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const TARGET_OWNER = '6yLuE8DJJvTTGhrXTZfbhdAkkr1rMSsvbFF9bHAfthyk';

async function scanForOwner() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Fetch Nodes
    console.log('Fetching Node Index...');
    const indexInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    const nodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        if (i + 32 > indexInfo!.data.length) break;
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') nodes.push(key);
    }
    console.log(`Scanning ${nodes.length} nodes for Owner ${TARGET_OWNER}...`);

    // 2. Fetch Registries
    const BATCH = 100;
    let matchFound = false;

    for (let i = 0; i < nodes.length; i += BATCH) {
        const batchNodes = nodes.slice(i, i + BATCH);
        const pdas = batchNodes.map(node => PublicKey.findProgramAddressSync([Buffer.from('registry'), node.toBuffer()], DEVNET_PROGRAM)[0]);
        const infos = await connection.getMultipleAccountsInfo(pdas);

        infos.forEach((info, idx) => {
            if (info && info.data.length >= 40) {
                const owner = new PublicKey(info.data.slice(8, 40)).toBase58();
                if (owner === TARGET_OWNER) {
                    console.log(`✅ MATCH FOUND!!`);
                    console.log(`   Node Pubkey: ${batchNodes[idx].toBase58()}`);
                    console.log(`   Registry PDA: ${pdas[idx].toBase58()}`);
                    console.log(`   Owner (Offset 8): ${owner}`);
                    matchFound = true;
                }
            }
        });
    }

    if (!matchFound) {
        console.log('❌ Owner not found in any Devnet Registry.');
    }
}
scanForOwner().catch(console.error);
