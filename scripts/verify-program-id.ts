
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = 'https://api.mainnet-beta.solana.com';

const ID_1 = 'CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL';
const ID_2 = '6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL';

async function main() {
    const conn = new Connection(RPC, 'confirmed');

    console.log(`Checking Program IDs on Mainnet...`);

    const info1 = await conn.getAccountInfo(new PublicKey(ID_1));
    console.log(`\nID 1 (${ID_1}):`);
    if (info1) {
        console.log(`- Exists!`);
        console.log(`- Owner: ${info1.owner.toBase58()}`);
        console.log(`- Executable: ${info1.executable}`);
    } else {
        console.log(`- Does NOT exist.`);
    }

    const info2 = await conn.getAccountInfo(new PublicKey(ID_2));
    console.log(`\nID 2 (${ID_2}):`);
    if (info2) {
        console.log(`- Exists!`);
        console.log(`- Owner: ${info2.owner.toBase58()}`);
        console.log(`- Executable: ${info2.executable}`);
    } else {
        console.log(`- Does NOT exist.`);
    }
}

main();
