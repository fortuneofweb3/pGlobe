
import { Connection, PublicKey } from '@solana/web3.js';

const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function main() {
    const rpc = 'https://api.mainnet.xandeum.com';
    console.log(`Checking Index Account on: ${rpc}`);
    try {
        const connection = new Connection(rpc, 'confirmed');
        const accountInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
        if (!accountInfo) {
            console.log('Index account not found on this RPC.');
            return;
        }
        console.log('Index Account Data Length:', accountInfo.data.length);

        const accountData = accountInfo.data;
        const pubkeys: string[] = [];
        const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

        for (let i = 0; i < accountData.length; i += 32) {
            if (i + 32 > accountData.length) break;
            try {
                const pubkey = new PublicKey(accountData.slice(i, i + 32));
                if (!pubkey.equals(DEFAULT_PUBKEY)) pubkeys.push(pubkey.toBase58());
            } catch (e) { continue; }
        }
        console.log(`Found ${pubkeys.length} pNodes in the index account.`);
        if (pubkeys.length > 0) {
            console.log('Sample pNodes:', pubkeys.slice(0, 5));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
