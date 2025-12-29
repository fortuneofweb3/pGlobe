
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function scanAllNodes() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Fetch All Nodes
    console.log('Fetching Node Index...');
    const indexInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (!indexInfo) throw new Error('Index not found');

    const nodes: PublicKey[] = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        if (i + 32 > indexInfo.data.length) break;
        const key = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            nodes.push(key);
        }
    }
    console.log(`Found ${nodes.length} nodes.`);

    // 2. Derive Registry PDAs
    console.log('Deriving Registry PDAs...');
    const registryMap = new Map<string, PublicKey>(); // Registry -> Node
    const registryPdas = nodes.map(node => {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), node.toBuffer()],
            DEVNET_PROGRAM
        );
        registryMap.set(pda.toBase58(), node);
        return pda;
    });

    // 3. Fetch Registry Accounts (Batching)
    console.log('Fetching Registry Accounts...');
    const BATCH = 100;
    const managersToResize: { owner: PublicKey, node: PublicKey }[] = [];

    for (let i = 0; i < registryPdas.length; i += BATCH) {
        const batch = registryPdas.slice(i, i + BATCH);
        const infos = await connection.getMultipleAccountsInfo(batch);

        infos.forEach((info, idx) => {
            if (info) {
                // Extract Owner (Offset 8)
                if (info.data.length >= 40) {
                    const owner = new PublicKey(info.data.slice(8, 40));
                    const node = registryMap.get(batch[idx].toBase58())!;
                    managersToResize.push({ owner, node });
                }
            }
        });
    }

    // 4. Derive Manager PDAs from Owners
    console.log(`Deriving Manager PDAs for ${managersToResize.length} owners...`);
    const managerMap = new Map<string, PublicKey>(); // ManagerPDA -> Owner
    const managerPdas = managersToResize.map(item => {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), item.owner.toBuffer()],
            DEVNET_PROGRAM
        );
        managerMap.set(pda.toBase58(), item.owner);
        return pda;
    });

    // 5. Fetch Manager PDAs
    console.log('Fetching Manager Accounts...');
    let foundCount = 0;

    for (let i = 0; i < managerPdas.length; i += BATCH) {
        const batch = managerPdas.slice(i, i + BATCH);
        const infos = await connection.getMultipleAccountsInfo(batch);

        infos.forEach((info, idx) => {
            if (info) {
                foundCount++;
                const pda = batch[idx];
                const owner = managerMap.get(pda.toBase58())!;

                console.log(`✅ FOUND MANAGER PDA: ${pda.toBase58()}`);
                console.log(`   Owner: ${owner.toBase58()}`);
                console.log(`   Size: ${info.data.length} bytes`);
                console.log(`   Data (Hex): ${info.data.toString('hex')}`);

                // Inspect Data
                if (info.data.length >= 32) {
                    const storedOwner = new PublicKey(info.data.slice(0, 32));
                    console.log(`   Stored Owner Key: ${storedOwner.toBase58()}`);
                }
            }
        });
    }

    console.log(`Scan complete. Found ${foundCount} active Manager PDAs.`);
}

scanAllNodes().catch(console.error);
