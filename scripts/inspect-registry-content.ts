
import { Connection, PublicKey } from '@solana/web3.js';

const XANDEUM_RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const REGISTRY_PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

const TARGET_MANAGER = '5yWDStcCB6DSGm44ixuQmu9GV1Aht8WhSCuKzth3tDQG';

async function main() {
    console.log(`Connecting to ${XANDEUM_RPC_URL}...`);
    const connection = new Connection(XANDEUM_RPC_URL, 'confirmed');

    console.log(`Fetching registry accounts...`);
    const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
        filters: [
            { dataSize: 1040 }
        ]
    });

    console.log(`Found ${accounts.length} accounts.`);

    // Find accounts for our target manager
    const matches = accounts.filter(acc => {
        // Manager is at offset 42
        const managerBytes = acc.account.data.slice(42, 74);
        const manager = new PublicKey(managerBytes).toBase58();
        return manager === TARGET_MANAGER;
    });

    console.log(`Found ${matches.length} accounts for manager ${TARGET_MANAGER}.`);

    matches.forEach((acc, index) => {
        const data = acc.account.data;
        console.log(`\n--- Registry Account #${index + 1}: ${acc.pubkey.toBase58()} ---`);
        console.log(`pNode (0-32): ${new PublicKey(data.slice(0, 32)).toBase58()}`);
        console.log(`Manager (42-74): ${new PublicKey(data.slice(42, 74)).toBase58()}`);

        console.log(`Bytes 32-42: ${data.slice(32, 42).toString('hex')}`);
        console.log(`Bytes 74-100: ${data.slice(74, 100).toString('hex')}`);
    });
}

main().catch(console.error);
