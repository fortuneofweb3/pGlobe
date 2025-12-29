/**
 * Find manager of a specific node using the offset 42 method
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const OWNER_OFFSET = 42;

async function findManager(nodeIdStr) {
    const conn = new Connection(DEVNET_RPC, 'confirmed');
    const nodeId = nodeIdStr || process.argv[2];

    if (!nodeId) {
        console.log('Usage: node find-node-manager.js <node-pubkey>');
        return;
    }

    console.log('Looking up manager for node:', nodeId);

    const nodePubkey = new PublicKey(nodeId);
    const [registryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), nodePubkey.toBuffer()],
        DEVNET_PROGRAM
    );

    console.log('Registry PDA:', registryPDA.toBase58());

    const info = await conn.getAccountInfo(registryPDA);
    if (!info) {
        console.log('No Registry PDA found for this node');
        return;
    }

    console.log('Registry data size:', info.data.length);

    if (info.data.length < OWNER_OFFSET + 32) {
        console.log('Registry data too small');
        return;
    }

    const owner = new PublicKey(info.data.slice(OWNER_OFFSET, OWNER_OFFSET + 32)).toBase58();
    console.log('Manager/Buyer wallet at offset 42:', owner);

    return owner;
}

findManager().catch(err => console.error('Error:', err.message));
