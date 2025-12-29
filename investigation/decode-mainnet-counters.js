/**
 * Decode Mainnet Account Counters
 * 
 * The 16 bytes seem to be structured as:
 * - Byte 0: Counter 1 (maybe node quantity?)
 * - Byte 1: Counter 2 (tier? batch?)
 * - Bytes 2-15: Padding/zero
 * 
 * Let's decode all 142 accounts and see if there's a pattern.
 * Maybe the PDA address itself is derived from (buyer_wallet, counter).
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function decodeCounters() {
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('=== Decoding Mainnet License Accounts ===\n');

    const accounts = await mainConn.getProgramAccounts(MAINNET_PROGRAM, {
        filters: [{ dataSize: 48 }]
    });
    console.log(`Found ${accounts.length} accounts.\n`);

    // Group by buyer
    const buyerToLicenses = new Map();

    for (const acc of accounts) {
        const data = acc.account.data;
        const buyer = new PublicKey(data.slice(0, 32)).toBase58();
        const counter1 = data[32];  // First byte after wallet
        const counter2 = data[33];  // Second byte

        if (!buyerToLicenses.has(buyer)) {
            buyerToLicenses.set(buyer, []);
        }
        buyerToLicenses.get(buyer).push({ pda: acc.pubkey.toBase58(), counter1, counter2 });
    }

    console.log(`Unique buyers: ${buyerToLicenses.size}\n`);

    // Show buyers with multiple licenses
    let totalLicenses = 0;
    for (const [buyer, licenses] of buyerToLicenses.entries()) {
        totalLicenses += licenses.length;
        if (licenses.length > 1) {
            console.log(`Buyer ${buyer.slice(0, 8)}... has ${licenses.length} license accounts:`);
            for (const lic of licenses) {
                console.log(`  - Counter1: ${lic.counter1}, Counter2: ${lic.counter2}`);
            }
        }
    }

    console.log(`\nTotal license accounts: ${totalLicenses}`);
    console.log(`Unique buyers: ${buyerToLicenses.size}`);
    console.log(`Average licenses per buyer: ${(totalLicenses / buyerToLicenses.size).toFixed(1)}`);

    // Now the key question: How does Counter1 and Counter2 relate to node assignment?
    // Maybe Counter1 = how many nodes this license covers?
    // Let's sum Counter1 values
    let sumCounter1 = 0;
    for (const acc of accounts) {
        sumCounter1 += acc.account.data[32];
    }
    console.log(`\nSum of Counter1 values: ${sumCounter1}`);
    console.log('(If this equals ~286, it might represent total node slots!)');

    // Check if any buyer has Counter1 totals matching the number of nodes we see them linked to
    console.log('\n--- Checking if Counter1 sums match observed node counts ---\n');

    // For buyers we KNOW have nodes (from our 7 mappings), check their Counter1
    const knownBuyers = [
        '4Ud8eU6dR6CGGAgrTJB2aVrsf3bce7eQyDZ1gRLTHNcn',
        'KeDctUqAjECBp8iMFXQZvjrn5BCJfWd1NXniMZofEDA',
        'F4XJsyo3gfDfrLMNoC3q3jpTWzF2vx8ntVJX9F2PLj5X',
        '5DrfPm15VwRPh6aZ7aZ22bsPj7jSWAWrCjmm13H9tosW',
        '5v22cdd6wwYA6F2VLsjt9pW9heWx6gcqnyRYmXmzqA84',
    ];

    for (const buyer of knownBuyers) {
        if (buyerToLicenses.has(buyer)) {
            const licenses = buyerToLicenses.get(buyer);
            const totalCounter1 = licenses.reduce((sum, l) => sum + l.counter1, 0);
            console.log(`Known buyer ${buyer.slice(0, 8)}...: ${licenses.length} accounts, sum Counter1 = ${totalCounter1}`);
        }
    }
}

decodeCounters().catch(console.error);
