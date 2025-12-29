
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const TARGET_OWNER = '5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W';

async function findNode() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // Get all nodes
    const indexInfo = await connection.getAccountInfo(DEVNET_INDEX);
    const nodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(key);
        }
    }
    console.log(`Searching ${nodes.length} nodes for owner ${TARGET_OWNER}...\n`);

    // Check each Registry PDA
    const BATCH = 100;
    for (let i = 0; i < nodes.length; i += BATCH) {
        const batch = nodes.slice(i, i + BATCH);
        const pdas = batch.map(n => PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), n.toBuffer()],
            DEVNET_PROGRAM
        )[0]);

        const infos = await connection.getMultipleAccountsInfo(pdas);

        for (let j = 0; j < infos.length; j++) {
            const info = infos[j];
            if (info && info.data.length >= 40) {
                const owner = new PublicKey(info.data.slice(8, 40)).toBase58();
                if (owner === TARGET_OWNER) {
                    console.log(`🎉 FOUND THE pNODE!`);
                    console.log(`   Node Pubkey: ${batch[j].toBase58()}`);
                    console.log(`   Registry PDA: ${pdas[j].toBase58()}`);
                    console.log(`   Owner (offset 8): ${owner}`);
                    console.log(`   Registry Size: ${info.data.length}`);
                    console.log(`   First 64 bytes: ${info.data.slice(0, 64).toString('hex')}`);
                    return;
                }
            }
        }
    }

    console.log('❌ Owner not found in any Registry.');
}

findNode().catch(console.error);
