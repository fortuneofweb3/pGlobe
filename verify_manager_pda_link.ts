
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const TEST_NODE_PUBKEY = new PublicKey('EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL');

async function verifyLink() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Fetch Registry PDA (pNode -> Registry)
    const [registryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), TEST_NODE_PUBKEY.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`Registry PDA: ${registryPda.toBase58()}`);

    // 2. Read Owner from Registry (Offset 8)
    const registryInfo = await connection.getAccountInfo(registryPda);
    if (!registryInfo) {
        console.log('Registry PDA not found.');
        return;
    }

    const ownerPubkey = new PublicKey(registryInfo.data.slice(8, 40));
    console.log(`Owner (from Registry offset 8): ${ownerPubkey.toBase58()}`);

    // 3. Derive Manager PDA (Owner -> Manager)
    const [managerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('manager'), ownerPubkey.toBuffer()],
        DEVNET_PROGRAM
    );
    console.log(`Expected Manager PDA: ${managerPda.toBase58()}`);

    // 4. Check if Manager PDA exists and has size 34
    const managerInfo = await connection.getAccountInfo(managerPda);
    if (managerInfo) {
        console.log(`✅ Manager PDA FOUND! Size: ${managerInfo.data.length}`);
        if (managerInfo.data.length === 34) {
            console.log('   Size matches known Manager PDA layout (34 bytes).');
            console.log('   This confirms the Owner is the Manager.');

            // 5. Parse Manager PDA data
            // Layout: Owner(32) + Purchased(1) + Registered(1)
            const storedOwner = new PublicKey(managerInfo.data.slice(0, 32));
            const purchased = managerInfo.data.readUInt8(32);
            const registered = managerInfo.data.readUInt8(33);

            console.log(`   Stored Owner: ${storedOwner.toBase58()}`);
            console.log(`   Purchased pNodes: ${purchased}`);
            console.log(`   Registered pNodes: ${registered}`);

            if (storedOwner.toBase58() === ownerPubkey.toBase58()) {
                console.log('   Data consistency check passed.');
            } else {
                console.log('   ❌ Data inconsistency in Manager PDA.');
            }
        }
    } else {
        console.log('❌ Manager PDA NOT found for this Owner.');
    }
}

verifyLink().catch(console.error);
