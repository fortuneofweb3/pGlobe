import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const HELIUS_RPC = 'https://devnet.helius-rpc.com/?api-key=2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';

async function getCreationSlot(addr: string) {
    const conn = new Connection(HELIUS_RPC);
    const sigs = await conn.getSignaturesForAddress(new PublicKey(addr), { limit: 1000 });
    if (sigs.length === 0) return null;
    // Earliest signature is at the end of the array
    return sigs[sigs.length - 1];
}

async function run() {
    const nodes = [
        'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC', // User target (Dec?)
        'EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL', // Sample 1
        '3iAYtMrGUnhzKhXdai3rsrF3FgpVJnULM5VR6Jx5wsep'  // Sample 2
    ];
    
    for (const node of nodes) {
        const [regPda] = PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(node).toBuffer()], DEVNET_PROGRAM);
        const firstSig = await getCreationSlot(regPda.toBase58());
        if (firstSig) {
            console.log(`Node ${node}: Created at Slot ${firstSig.slot} (${new Date(firstSig.blockTime! * 1000).toLocaleDateString()})`);
        } else {
            console.log(`Node ${node}: No signatures found for registry PDA`);
        }
    }
}
run().catch(console.error);
