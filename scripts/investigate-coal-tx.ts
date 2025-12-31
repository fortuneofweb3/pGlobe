import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');

    // Check the "Coal" node's registry creation transaction
    const coalNode = '4mdmbePoBNWBJVBq69DeXjdeoTZBfi9nWWmeCzKcyfpq';
    const [regPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('registry'), new PublicKey(coalNode).toBuffer()],
        DEVNET_PROGRAM
    );

    console.log('Coal Node Registry PDA:', regPda.toBase58());

    // Get all signatures for this registry account
    const sigs = await conn.getSignaturesForAddress(regPda, { limit: 10 });
    console.log('\nFound', sigs.length, 'transactions');

    // Get the FIRST transaction (creation)
    if (sigs.length > 0) {
        const firstSig = sigs[sigs.length - 1];
        console.log('\nFirst Signature:', firstSig.signature);

        const tx = await conn.getTransaction(firstSig.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (tx) {
            console.log('\n=== REGISTRATION TRANSACTION ===');
            console.log('Slot:', tx.slot);
            console.log('Block Time:', new Date((tx.blockTime || 0) * 1000).toISOString());

            const instructions = tx.transaction.message.compiledInstructions;
            for (let i = 0; i < instructions.length; i++) {
                const ix = instructions[i];
                const programIdx = ix.programIdIndex;
                const programId = tx.transaction.message.staticAccountKeys[programIdx];

                if (programId.equals(DEVNET_PROGRAM)) {
                    const data = Buffer.from(ix.data);
                    console.log('\n--- Xandeum Instruction', i, '---');
                    console.log('Data (hex):', data.toString('hex'));
                    console.log('Length:', data.length);
                    console.log('First 32 bytes:', data.slice(0, 32).toString('hex'));

                    // Try to parse as version info
                    if (data.length >= 10) {
                        console.log('Byte 8:', data[8]);
                        console.log('Byte 9:', data[9]);
                        console.log('u16 at offset 8:', data.readUInt16LE(8));
                    }
                }
            }
        }
    }
}

run().catch(console.error);
