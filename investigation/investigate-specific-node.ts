/**
 * Deep investigation of specific unregistered node
 * BTy8gWMBozRFhoNuTfiSL8yqDe6VhUJ5F52A79D74snY
 */

import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

const TARGET_NODE = 'BTy8gWMBozRFhoNuTfiSL8yqDe6VhUJ5F52A79D74snY';

async function investigateNode() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const nodePk = new PublicKey(TARGET_NODE);

    console.log(`=== Deep Investigation of Node ===`);
    console.log(`Node: ${TARGET_NODE}\n`);

    // 1. Check if it's in the Devnet index
    console.log('--- 1. Check Devnet Index ---');
    const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
    const indexInfo = await devConn.getAccountInfo(DEVNET_INDEX);
    let foundInIndex = false;
    if (indexInfo) {
        for (let i = 0; i < indexInfo.data.length; i += 32) {
            const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
            if (pk.toBase58() === TARGET_NODE) {
                foundInIndex = true;
                console.log(`  Found at index position: ${i / 32}`);
                break;
            }
        }
    }
    console.log(`  In Devnet index: ${foundInIndex}\n`);

    // 2. Check Devnet Registry PDA
    console.log('--- 2. Check Devnet Registry PDA ---');
    const [registryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), nodePk.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`  Registry PDA: ${registryPda.toBase58()}`);
    const regInfo = await devConn.getAccountInfo(registryPda);
    console.log(`  Exists: ${regInfo ? 'YES' : 'NO'}\n`);

    // 3. Check Devnet Manager PDA
    console.log('--- 3. Check Devnet Manager PDA ---');
    const [managerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), nodePk.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`  Manager PDA: ${managerPda.toBase58()}`);
    const manInfo = await devConn.getAccountInfo(managerPda);
    console.log(`  Exists: ${manInfo ? 'YES' : 'NO'}\n`);

    // 4. Check Devnet transaction history for the node
    console.log('--- 4. Devnet Transaction History ---');
    const devSigs = await devConn.getSignaturesForAddress(nodePk, { limit: 10 });
    console.log(`  Transactions: ${devSigs.length}`);
    for (const sig of devSigs) {
        console.log(`    ${sig.signature}`);
        const tx = await devConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (tx) {
            const signers = tx.transaction.message.accountKeys.filter(a => a.signer);
            console.log(`      Signers: ${signers.map(s => s.pubkey.toBase58()).join(', ')}`);
        }
    }
    console.log('');

    // 5. Check Mainnet for any trace of this pubkey
    console.log('--- 5. Mainnet Checks ---');

    // 5a. Check if pubkey exists on mainnet
    const mainInfo = await mainConn.getAccountInfo(nodePk);
    console.log(`  Account exists on Mainnet: ${mainInfo ? 'YES' : 'NO'}`);

    // 5b. Check mainnet transaction history
    const mainSigs = await mainConn.getSignaturesForAddress(nodePk, { limit: 10 });
    console.log(`  Mainnet transactions: ${mainSigs.length}`);
    for (const sig of mainSigs) {
        console.log(`    ${sig.signature}`);
    }

    // 5c. Check if any Mainnet PDAs exist for this node
    const mainnetSeeds = ['registry', 'manager', 'node', 'pnode', 'owner'];
    console.log(`  Mainnet PDAs:`);
    for (const seed of mainnetSeeds) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from(seed), nodePk.toBuffer()],
            MAINNET_PROGRAM
        );
        const info = await mainConn.getAccountInfo(pda);
        console.log(`    "${seed}": ${pda.toBase58().slice(0, 10)}... - ${info ? 'EXISTS' : 'NO'}`);
    }
    console.log('');

    // 6. Check if this pubkey appears in ANY mainnet program account data
    console.log('--- 6. Search Mainnet Program Accounts for Node Pubkey ---');
    const allMainnetAccounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM);
    console.log(`  Total Mainnet program accounts: ${allMainnetAccounts.length}`);

    let foundIn = [];
    for (const acc of allMainnetAccounts) {
        const data = acc.account.data;
        // Search for the node pubkey bytes anywhere in the data
        const nodeBytes = nodePk.toBuffer();
        for (let i = 0; i <= data.length - 32; i++) {
            if (data.slice(i, i + 32).equals(nodeBytes)) {
                foundIn.push({ account: acc.pubkey.toBase58(), offset: i });
            }
        }
    }

    if (foundIn.length > 0) {
        console.log(`  ** FOUND in ${foundIn.length} accounts! **`);
        for (const f of foundIn) {
            console.log(`    Account: ${f.account}, Offset: ${f.offset}`);
        }
    } else {
        console.log(`  Node pubkey NOT found in any Mainnet program account data.`);
    }
    console.log('');

    // 7. Final verdict
    console.log('=== CONCLUSION ===\n');
    console.log('Based on investigation:');
    console.log(`- Node is in Devnet index: ${foundInIndex}`);
    console.log(`- Has Registry PDA: ${regInfo ? 'YES' : 'NO'}`);
    console.log(`- Has Manager PDA: ${manInfo ? 'YES' : 'NO'}`);
    console.log(`- Devnet transactions: ${devSigs.length}`);
    console.log(`- Mainnet transactions: ${mainSigs.length}`);
    console.log(`- Found in Mainnet program data: ${foundIn.length > 0 ? 'YES' : 'NO'}`);

    if (!regInfo && !manInfo && devSigs.length === 0 && mainSigs.length === 0 && foundIn.length === 0) {
        console.log('\n** This node has NO on-chain footprint linking it to any buyer. **');
        console.log('** It only exists in the gossip network / index. **');
    }
}

investigateNode().catch(console.error);
