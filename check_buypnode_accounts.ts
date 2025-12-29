
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_INDEX = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

// Accounts from the BuypNode transaction for wallet 5qRv...
const TX_ACCOUNTS = [
    '5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W', // 0: Signer
    '8VxLopT96jGjwhNsiqckyv2PbdPLQqttn58YbGm2n6xX', // 1: PDA (pNode account)
    'XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx',  // 2: XAND Mint
    'CkE2CuVU4vX7E5ZAsV61CZs3b4GiREtmbe8thGYF9d8u', // 3: XAND ATA of signer
    'E2jV5bsuxoUB5rXzwY4zcbNAT5nBJJ7Z1HxLwpgoqtVV', // 4: Unknown
    'CaGfz4CkN4otKGsC38r3GfxXAJKmkUSJaJSx6Bfh5Fnt', // 5: Unknown
    'FBFLnHdLhLs5qcF3mNABLkHMyATbSzTLA4PdfUxFLaxz', // 6: State (1536 bytes)
    '2GVyqtLzskdo3Kxako3RhSuCCuWNaYpWMk6VuQis3RE8', // 7: Config (80 bytes)
];

const INSTRUCTION_DATA = '2Vm4mJj9';

async function checkAccounts() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // 1. Get Devnet Nodes
    console.log('Fetching Devnet nodes...');
    const indexInfo = await connection.getAccountInfo(DEVNET_INDEX);
    const devnetNodes = new Set<string>();
    for (let i = 0; i < indexInfo!.data.length; i += 32) {
        const key = new PublicKey(indexInfo!.data.slice(i, i + 32));
        if (key.toBase58() !== '11111111111111111111111111111111') {
            devnetNodes.add(key.toBase58());
        }
    }
    console.log(`Devnet has ${devnetNodes.size} nodes.\n`);

    // 2. Check each TX account
    console.log('Checking if TX accounts are Devnet Nodes...');
    for (const acc of TX_ACCOUNTS) {
        const isNode = devnetNodes.has(acc);
        console.log(`   ${acc}: ${isNode ? '✅ IS A DEVNET NODE!' : '❌ No'}`);
    }

    // 3. Decode instruction data
    console.log('\nDecoding instruction data...');
    const dataBytes = bs58.decode(INSTRUCTION_DATA);
    console.log(`   Base58: ${INSTRUCTION_DATA}`);
    console.log(`   Bytes (${dataBytes.length}): ${Buffer.from(dataBytes).toString('hex')}`);

    // Anchor discriminator is first 8 bytes
    if (dataBytes.length >= 8) {
        console.log(`   Discriminator: ${Buffer.from(dataBytes.slice(0, 8)).toString('hex')}`);

        // If there's more data, it might be a pubkey (32 bytes)
        if (dataBytes.length >= 40) {
            const possiblePubkey = new PublicKey(dataBytes.slice(8, 40));
            console.log(`   Possible Pubkey in data: ${possiblePubkey.toBase58()}`);
            console.log(`   Is Devnet Node? ${devnetNodes.has(possiblePubkey.toBase58())}`);
        }
    }
}

checkAccounts().catch(console.error);
