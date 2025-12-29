const { Connection, PublicKey } = require('@solana/web3.js');

async function main() {
    const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const govProgram = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
    const managerWallet = new PublicKey('Bx1aHrYYhrqKAHkJZE7qrbEBHX43LBKgsy3aBwu2h1Zr');
    const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

    console.log('Searching for ALL accounts related to this wallet in gov program...');

    // Search by wallet anywhere in the data
    const accountsByOwner = await conn.getProgramAccounts(govProgram, {
        filters: [
            { memcmp: { offset: 65, bytes: managerWallet.toBase58() } }
        ]
    });

    console.log('Found', accountsByOwner.length, 'at offset 65 (governing_token_owner)');

    // Also search at offset 33 (different field position)
    const accountsAt33 = await conn.getProgramAccounts(govProgram, {
        filters: [
            { memcmp: { offset: 33, bytes: managerWallet.toBase58() } }
        ]
    });

    console.log('Found', accountsAt33.length, 'at offset 33');

    // Combine and analyze
    const allAccounts = [...accountsByOwner, ...accountsAt33];

    for (const acc of allAccounts) {
        console.log('\n=== Account:', acc.pubkey.toBase58(), '===');
        console.log('Size:', acc.account.data.length);

        const data = acc.account.data;

        // Search for stake value
        for (let offset = 0; offset <= data.length - 8; offset += 8) {
            const val = data.readBigUInt64LE(offset);
            const asXand = Number(val) / 1e9;
            if (asXand >= 100000 && asXand <= 600000) {
                console.log('** STAKE FOUND at offset', offset, ':', asXand.toLocaleString(), 'XAND **');
            }
        }
    }

    // Also check the wallet's token accounts for XAND deposits
    console.log('\n--- XAND Token Accounts for wallet ---');
    const tokenAccs = await conn.getTokenAccountsByOwner(managerWallet, { mint: XAND_MINT });
    console.log('Found', tokenAccs.value.length, 'XAND token accounts');
    for (const t of tokenAccs.value) {
        const balance = await conn.getTokenAccountBalance(t.pubkey);
        console.log('  ', t.pubkey.toBase58().slice(0, 16) + '...:', balance.value.uiAmountString, 'XAND');
    }
}

setTimeout(() => process.exit(1), 60000);
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
