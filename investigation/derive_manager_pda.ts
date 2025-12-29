
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const TEST_NODE_PUBKEY = new PublicKey('EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL');

async function deriveManager() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Try 1: 'manager' + node_pubkey
    const [pda1, bump1] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), TEST_NODE_PUBKEY.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`Derivation 1 (manager + node): ${pda1.toBase58()} (bump: ${bump1})`);
    const info1 = await connection.getAccountInfo(pda1);
    console.log(`Exists? ${!!info1} (Size: ${info1?.data.length})`);

    // Try 2: 'manager' + node_pubkey (as string?) - unlikely but possible
    const [pda2, bump2] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), Buffer.from(TEST_NODE_PUBKEY.toBase58())],
        DEVNET_PROGRAM
    );
    console.log(`Derivation 2 (manager + nodeString): ${pda2.toBase58()} (bump: ${bump2})`);
    const info2 = await connection.getAccountInfo(pda2);
    console.log(`Exists? ${!!info2} (Size: ${info2?.data.length})`);

    // Try 3: just 'manager' ? (Global manager?)
    const [pda3, bump3] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager')],
        DEVNET_PROGRAM
    );
    console.log(`Derivation 3 (manager only): ${pda3.toBase58()} (bump: ${bump3})`);
    const info3 = await connection.getAccountInfo(pda3);
    console.log(`Exists? ${!!info3} (Size: ${info3?.data.length})`);

}

deriveManager().catch(console.error);
