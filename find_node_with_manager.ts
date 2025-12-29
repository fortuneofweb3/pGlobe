
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
// The Index Account has ALL nodes
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function findNodeWithManager() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Get all nodes
    const indexInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (!indexInfo) return;
    const allNodes: string[] = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        if (i + 32 > indexInfo.data.length) break;
        const key = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            allNodes.push(key.toBase58());
        }
    }
    console.log(`Checking ${allNodes.length} nodes for managers...`);

    // 2. Check existence of Manager PDA for each
    const BATCH_SIZE = 100;
    for (let i = 0; i < allNodes.length; i += BATCH_SIZE) {
        const batch = allNodes.slice(i, i + BATCH_SIZE);
        const pdas = batch.map(node => {
            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from('manager'), new PublicKey(node).toBuffer()],
                DEVNET_PROGRAM
            );
            return pda;
        });

        const infos = await connection.getMultipleAccountsInfo(pdas);

        for (let j = 0; j < infos.length; j++) {
            if (infos[j]) {
                const node = batch[j];
                const pda = pdas[j].toBase58();
                const size = infos[j]!.data.length;
                console.log(`✅ FOUND MANAGER! Node: ${node} -> PDA: ${pda} (Size: ${size})`);

                // Inspect this manager account
                const data = infos[j]!.data;
                console.log(`   Data (Hex): ${data.toString('hex')}`);

                // If size is 34, what's inside?
                if (size === 34) {
                    // Try offset 2 for pubkey?
                    const key = new PublicKey(data.slice(2, 34)).toBase58();
                    console.log(`   Potential Wallet (Offset 2): ${key}`);
                }

                // Stop after finding one
                return;
            }
        }
    }
    console.log('No nodes with managers found.');
}

findNodeWithManager().catch(console.error);
