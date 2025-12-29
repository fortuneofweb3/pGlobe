
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MANAGER_WALLET = new PublicKey('5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W');

async function findRegistration() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log(`Looking for pNode registered by Manager Wallet: ${MANAGER_WALLET.toBase58()}\n`);

    // Try deriving Registry PDA from Manager Wallet
    const [registryFromWallet] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), MANAGER_WALLET.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`Registry PDA (from wallet): ${registryFromWallet.toBase58()}`);

    const registryInfo = await connection.getAccountInfo(registryFromWallet);
    if (registryInfo) {
        console.log('✅ Registry EXISTS!');
        console.log(`   Size: ${registryInfo.data.length}`);
        console.log(`   Data (first 64 bytes): ${registryInfo.data.slice(0, 64).toString('hex')}`);

        // Try to extract pNode Identity from Registry data
        if (registryInfo.data.length >= 40) {
            const possibleNode = new PublicKey(registryInfo.data.slice(8, 40));
            console.log(`   Key@8 (possible pNode): ${possibleNode.toBase58()}`);
        }
        if (registryInfo.data.length >= 72) {
            const possibleNode2 = new PublicKey(registryInfo.data.slice(40, 72));
            console.log(`   Key@40 (possible pNode): ${possibleNode2.toBase58()}`);
        }
    } else {
        console.log('❌ Registry NOT found (derived from wallet).');
    }

    // Also try Manager PDA
    const [managerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), MANAGER_WALLET.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`\nManager PDA (from wallet): ${managerPDA.toBase58()}`);

    const managerInfo = await connection.getAccountInfo(managerPDA);
    if (managerInfo) {
        console.log('✅ Manager PDA EXISTS!');
        console.log(`   Size: ${managerInfo.data.length}`);
        console.log(`   Data: ${managerInfo.data.toString('hex')}`);

        // Manager structure from pNodeHelpers.ts: owner (32), purchased_pnodes (1), registered_pnodes (1)
        const owner = new PublicKey(managerInfo.data.slice(0, 32));
        const purchased = managerInfo.data[32];
        const registered = managerInfo.data[33];
        console.log(`   Owner: ${owner.toBase58()}`);
        console.log(`   Purchased pNodes: ${purchased}`);
        console.log(`   Registered pNodes: ${registered}`);
    } else {
        console.log('❌ Manager PDA NOT found.');
    }
}

findRegistration().catch(console.error);
