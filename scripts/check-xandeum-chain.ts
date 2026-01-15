
import { Connection, PublicKey } from '@solana/web3.js';

const RPCS = [
    'https://rpc3.pchednode.com/rpc',
    'https://rpc1.pchednode.com/rpc',
    'http://rpc3.pchednode.com/rpc',
    'https://api.devnet.xandeum.com:8899'
];

const TARGET_KEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHG4d3', // Typo variant
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
];

const PROGRAMS = [
    { name: 'Purchase (Mainnet)', id: 'CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL' },
    { name: 'Devnet/Sidechain', id: '6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL' },
    { name: 'PNode Program', id: '3hMZVwdgRHYSyqkdK3Y8MdZzNwLkjzXod1XrKcniXw56' }
];

async function tryConnect(url: string) {
    console.log(`Trying ${url}...`);
    try {
        const conn = new Connection(url, 'confirmed');
        const version = await conn.getVersion();
        console.log(`  ✅ Success! Version: ${JSON.stringify(version)}`);
        return conn;
    } catch (e: any) {
        console.log(`  ❌ Failed to connect: ${e.message}`);
        return null;
    }
}

async function main() {
    let conn: Connection | null = null;

    for (const url of RPCS) {
        conn = await tryConnect(url);
        if (conn) break;
    }

    if (!conn) {
        console.error('❌ Could not connect to ANY RPC.');
        return;
    }

    console.log(`\n--- Searching for Target Nodes on Connected Chain ---`);
    for (const keyStr of TARGET_KEYS) {
        try {
            const pk = new PublicKey(keyStr);
            const info = await conn.getAccountInfo(pk);
            if (info) {
                console.log(`✅ FOUND: ${keyStr}`);
                console.log(`   Owner: ${info.owner.toBase58()}`);
                console.log(`   Data Len: ${info.data.length}`);
                console.log(`   Lamports: ${info.lamports}`);
            } else {
                console.log(`❌ Not Found: ${keyStr}`);
            }
        } catch (e) {
            console.log(`⚠️ Invalid Key: ${keyStr}`);
        }
    }

    console.log(`\n--- Scanning for Programs on Connected Chain ---`);
    for (const prog of PROGRAMS) {
        try {
            const pk = new PublicKey(prog.id);
            const info = await conn.getAccountInfo(pk);
            if (info) {
                console.log(`✅ FOUND PROGRAM: ${prog.name} (${prog.id})`);
                console.log(`   Executable: ${info.executable}`);

                // Scan for accounts owned by this program
                const accounts = await conn.getProgramAccounts(pk, {
                    dataSlice: { offset: 0, length: 0 }
                });
                console.log(`   -> Owns ${accounts.length} accounts on this chain.`);
            } else {
                console.log(`❌ Program Not Found: ${prog.name} (${prog.id})`);
            }
        } catch (e) {
            console.log(`⚠️ Error checking program ${prog.name}: ${e.message}`);
        }
    }
}

main();
