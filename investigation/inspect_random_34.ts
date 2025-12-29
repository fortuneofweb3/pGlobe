
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function inspectRandom34() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Fetch size 34
    const accounts = await connection.getProgramAccounts(DEVNET_PROGRAM, { filters: [{ dataSize: 34 }] });
    if (accounts.length === 0) return;

    // Take the first one
    const acc = accounts[0];
    console.log(`Inspecting Size 34 Account: ${acc.pubkey.toBase58()}`);
    console.log(`Data (Hex): ${acc.account.data.toString('hex')}`);

    // Try to guess seeds by iterating ALL nodes?
    // That's 286 checks * (seeds)
    // Maybe we just check its data. 34 bytes.
    // 8 discriminator + ??

    // Most likely: 'pnode' seed?
    // Let's testing 'pnode' seed for this account against ALL nodes
    const indexInfo = await connection.getAccountInfo(new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs'));
    const allNodes: string[] = [];
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const k = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (k.toBase58() !== '11111111111111111111111111111111') allNodes.push(k.toBase58());
    }

    console.log(`Checking ${allNodes.length} nodes against account ${acc.pubkey.toBase58()}...`);

    // Check 'pnode' seed
    for (const node of allNodes) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('pnode'), new PublicKey(node).toBuffer()],
            DEVNET_PROGRAM
        );
        if (pda.toBase58() === acc.pubkey.toBase58()) {
            console.log(`MATCH! Account is 'pnode' PDA for node: ${node}`);
            return;
        }
    }

    console.log('No match found for pnode seed.');
}

inspectRandom34().catch(console.error);
