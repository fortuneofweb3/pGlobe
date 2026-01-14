
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Program ID identified by user
const REGISTRY_PROGRAM_ID = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
// Helius API key from previous files
// Xandeum Custom RPC provided by user
const RPC_URL = 'https://api.devnet.xandeum.com:8899/';

async function decodeRegistry() {
    console.log('Fetching registry accounts...');
    const connection = new Connection(RPC_URL, 'confirmed');

    // Fetch accounts with dataSize 1040 as noted by user
    const accounts = await connection.getProgramAccounts(REGISTRY_PROGRAM_ID, {
        filters: [
            { dataSize: 1040 }
        ]
    });

    console.log(`Found ${accounts.length} registry accounts.`);

    if (accounts.length === 0) return;

    // Target keys from CSV (Index 1)
    const targetNode = 'Hj5owPSHVAxbcvDSrukN4MtLf4Sw34uskyXMdBtTUfTu';
    const targetManager = '68jGBZsX3LwZWKwMmi2feZNvMDeANRMwsHAHQRHN5YJP';

    console.log(`\nSearching for Node: ${targetNode}`);
    console.log(`Searching for Manager: ${targetManager}`);

    for (const { pubkey, account } of accounts) {
        const data = account.data;

        // Brute force check offsets
        const nodeBytes = new PublicKey(targetNode).toBuffer();
        const managerBytes = new PublicKey(targetManager).toBuffer();

        const nodeIndex = data.indexOf(nodeBytes);
        const managerIndex = data.indexOf(managerBytes);

        if (nodeIndex !== -1 || managerIndex !== -1) {
            console.log(`\nMATCH FOUND in Account: ${pubkey.toBase58()}`);
            if (nodeIndex !== -1) console.log(`  Target Node found at offset: ${nodeIndex}`);
            if (managerIndex !== -1) console.log(`  Target Manager found at offset: ${managerIndex}`);
        }
    }
}

decodeRegistry().catch(console.error);
