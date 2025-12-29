/**
 * Match Mainnet License Slots to Devnet Nodes
 * 
 * BREAKTHROUGH: Counter1 = number of nodes this buyer is entitled to.
 * BUT the Mainnet account doesn't store WHICH nodes.
 * 
 * NEW HYPOTHESIS: The Devnet Manager PDA (derived from buyer wallet) stores 
 * the COUNT of nodes registered. If a buyer's Devnet Manager PDA count 
 * matches their Mainnet Counter1, we have a match!
 * 
 * Structure of Devnet Manager PDA (34 bytes):
 * - Bytes 0-32: Authority (buyer wallet)
 * - Byte 33: Count of registered nodes
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function matchLicensesToNodes() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');
    const devConn = new Connection(DEVNET_RPC, 'confirmed');

    console.log('=== Matching Mainnet Licenses to Devnet Nodes ===\n');

    // Get Mainnet buyers and their counts
    const accounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });

    const buyerData = new Map();
    for (const acc of accounts) {
        const data = acc.account.data;
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        const nodeCount = data[32];  // Counter1 = number of nodes

        if (!buyerData.has(buyer)) {
            buyerData.set(buyer, { nodeCount: 0, pda: acc.pubkey.toBase58() });
        }
        buyerData.get(buyer).nodeCount += nodeCount;
    }

    console.log(`Found ${buyerData.size} Mainnet buyers with license counts.\n`);

    // Get Devnet nodes
    const indexInfo = await devConn.getAccountInfo(INDEX_ACCOUNT);
    const devnetNodes = [];
    for (let i = 0; i < indexInfo.data.length; i += 32) {
        const pk = new PublicKey(indexInfo.data.slice(i, i + 32));
        if (pk.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.push(pk.toBase58());
        }
    }
    console.log(`Found ${devnetNodes.length} Devnet nodes.\n`);

    // For each buyer, check their Devnet Manager PDA
    console.log('Checking Devnet Manager PDAs for each Mainnet buyer...\n');

    const buyersWithDevnetActivity = [];
    let checked = 0;

    for (const [buyer, data] of buyerData.entries()) {
        checked++;
        if (checked % 20 === 0) {
            console.log(`Progress: ${checked}/${buyerData.size}...`);
        }

        try {
            const [managerPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('manager'), new PublicKey(buyer).toBuffer()],
                DEVNET_PROGRAM
            );

            const managerInfo = await devConn.getAccountInfo(managerPDA);
            if (managerInfo) {
                const devnetCount = managerInfo.data[33] || 0;  // Byte 33 = count
                buyersWithDevnetActivity.push({
                    buyer,
                    mainnetLicenseCount: data.nodeCount,
                    devnetRegisteredCount: devnetCount,
                    managerPDA: managerPDA.toBase58()
                });

                if (data.nodeCount > 0) {
                    console.log(`  ${buyer.slice(0, 8)}... Mainnet: ${data.nodeCount}, Devnet: ${devnetCount}`);
                }
            }
        } catch (e) { }

        await new Promise(r => setTimeout(r, 30));
    }

    console.log(`\n--- Summary ---`);
    console.log(`Mainnet buyers: ${buyerData.size}`);
    console.log(`With Devnet Manager PDA: ${buyersWithDevnetActivity.length}`);
    console.log(`\nBuyers with matching counts (Mainnet == Devnet):`);

    const matched = buyersWithDevnetActivity.filter(b => b.mainnetLicenseCount === b.devnetRegisteredCount && b.mainnetLicenseCount > 0);
    for (const m of matched) {
        console.log(`  ${m.buyer.slice(0, 8)}... = ${m.mainnetLicenseCount} nodes`);
    }
    console.log(`Total matched: ${matched.length}`);
}

matchLicensesToNodes().catch(console.error);
