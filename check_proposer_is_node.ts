
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const PROPOSER_KEY = 'AEL8CwbYfiAhkqui1NF2bbv5DX9mgSNGcxenpTdpsyY4';

async function checkProposer() {
    console.log(`Checking if Proposer ${PROPOSER_KEY} is a registered pNode...`);
    // We can check if it has a Registry PDA
    // Or if it is in the Node Index

    // Check Registry PDA
    const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
    const [registry] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), new PublicKey(PROPOSER_KEY).toBuffer()],
        DEVNET_PROGRAM
    );

    const connection = new Connection(RPC_URL, 'confirmed');
    const info = await connection.getAccountInfo(registry);

    if (info) {
        console.log(`✅ MATCH! Proposer ${PROPOSER_KEY} has a Registry PDA. It IS a pNode.`);
        console.log(`Registry PDA: ${registry.toBase58()}`);
    } else {
        console.log(`❌ Proposer ${PROPOSER_KEY} does NOT have a Registry PDA.`);
    }
}

checkProposer().catch(console.error);
