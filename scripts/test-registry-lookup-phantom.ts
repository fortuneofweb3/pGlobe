
import { Connection, PublicKey } from '@solana/web3.js';

const XANDEUM_RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const REGISTRY_PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

const TARGET_NODE = 'DJXVVM8J2xhe5dERZ4je4ZySVNYcSyT55fXMmXJ4wij9';

async function main() {
    console.log(`Connecting to ${XANDEUM_RPC_URL}...`);
    const connection = new Connection(XANDEUM_RPC_URL, 'confirmed');

    console.log(`Fetching registry account for pNode ${TARGET_NODE}...`);

    // Use memcmp filter for efficiency
    const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
        filters: [
            { dataSize: 1040 },
            {
                memcmp: {
                    offset: 0,
                    bytes: TARGET_NODE
                }
            }
        ]
    });

    console.log(`Found ${accounts.length} accounts.`);

    accounts.forEach((acc, index) => {
        const data = acc.account.data;
        console.log(`\n--- Registry Account #${index + 1}: ${acc.pubkey.toBase58()} ---`);
        console.log(`pNode (0-32): ${new PublicKey(data.slice(0, 32)).toBase58()}`);
        console.log(`Manager (42-74): ${new PublicKey(data.slice(42, 74)).toBase58()}`);
    });
}

main().catch(console.error);
