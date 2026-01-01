
import { Connection } from '@solana/web3.js';

async function main() {
    const rpc = 'https://api.mainnet.xandeum.com';
    console.log(`Checking RPC: ${rpc}`);
    try {
        const connection = new Connection(rpc, 'confirmed');
        const version = await connection.getVersion();
        console.log('Version:', version);
        const slot = await connection.getSlot();
        console.log('Current Slot:', slot);
        const genesis = await connection.getGenesisHash();
        console.log('Genesis Hash:', genesis);
    } catch (err) {
        console.error('Error connecting to RPC:', err);
    }
}

main();
