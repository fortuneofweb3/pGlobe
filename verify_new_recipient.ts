
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');

const TARGET_WALLET = new PublicKey('5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W');

async function check() {
    console.log(`Checking ${TARGET_WALLET.toBase58()}...`);

    // 1. Check Mainnet XAND
    try {
        const mc = new Connection(MAINNET_RPC, 'confirmed');
        const tokenAccounts = await mc.getParsedTokenAccountsByOwner(TARGET_WALLET, { mint: XAND_MINT });
        if (tokenAccounts.value.length > 0) {
            console.log(`✅ Mainnet: Wallet holds ${tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount} XAND.`);
        } else {
            console.log('⚠️  Mainnet: Wallet has NO XAND (might have moved it?).');
        }
    } catch (e) {
        console.log('Error checking Mainnet:', e);
    }

    // 2. Scan Devnet Registries
    try {
        const dc = new Connection(DEVNET_RPC, 'confirmed');
        const index = await dc.getAccountInfo(INDEX_ACCOUNT);
        const nodes: PublicKey[] = [];
        for (let i = 0; i < index!.data.length; i += 32) {
            const key = new PublicKey(index!.data.slice(i, i + 32));
            if (key.toBase58() !== '11111111111111111111111111111111') nodes.push(key);
        }
        console.log(`Scanning ${nodes.length} Devnet nodes...`);

        const BATCH = 100;
        let found = false;

        for (let i = 0; i < nodes.length; i += BATCH) {
            const batch = nodes.slice(i, i + BATCH);
            const pdas = batch.map(n => PublicKey.findProgramAddressSync([Buffer.from('registry'), n.toBuffer()], DEVNET_PROGRAM)[0]);
            const infos = await dc.getMultipleAccountsInfo(pdas);

            infos.forEach((info, idx) => {
                if (info && info.data.length >= 40) {
                    const owner = new PublicKey(info.data.slice(8, 40));
                    if (owner.equals(TARGET_WALLET)) {
                        console.log(`🎉 MATCH FOUND!`);
                        console.log(`   Node: ${batch[idx].toBase58()}`);
                        console.log(`   Owner in Registry is Target Wallet.`);
                        found = true;
                    }
                }
            });
        }

        if (!found) console.log('❌ Target wallet NOT found in any Devnet Registry.');

    } catch (e) {
        console.log('Error checking Devnet:', e);
    }
}

check();
