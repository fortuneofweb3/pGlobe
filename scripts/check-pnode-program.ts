
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = 'https://rpc3.pchednode.com/rpc';
const PNODE_PROGRAM_ID = new PublicKey('3hMZVwdgRHYSyqkdK3Y8MdZzNwLkjzXod1XrKcniXw56');

async function main() {
    console.log(`Connecting to ${RPC}...`);
    const conn = new Connection(RPC, 'confirmed');

    try {
        const info = await conn.getAccountInfo(PNODE_PROGRAM_ID);
        if (info) {
            console.log(`✅ PNODE Program Found on this chain!`);
            console.log(`   Owner: ${info.owner.toBase58()}`);
            console.log(`   Executable: ${info.executable}`);

            // Try to check for pNodes? Maybe different data size?
            console.log(`\nScanning for accounts owned by PNODE Program...`);
            const accounts = await conn.getProgramAccounts(PNODE_PROGRAM_ID, {
                dataSlice: { offset: 0, length: 0 },
                filters: [
                    { dataSize: 64 } // Just a guess, or check all
                ]
            });
            console.log(`✅ Found ${accounts.length} accounts of size 64.`);

            const allAccounts = await conn.getProgramAccounts(PNODE_PROGRAM_ID, {
                dataSlice: { offset: 0, length: 0 },
            });
            console.log(`✅ Found ${allAccounts.length} TOTAL accounts owned by PNODE program.`);

        } else {
            console.log(`❌ PNODE Program NOT found on this chain.`);
        }
    } catch (e) {
        console.error(`Connection Error:`, e.message);
    }
}

main();
