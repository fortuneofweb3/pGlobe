import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { getNodesCollection } from '../lib/server/mongodb-nodes';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function lookupMissing() {
    const conn = new Connection(DEVNET_RPC, 'confirmed');
    const collection = await getNodesCollection();

    // Get all nodes missing registrarWallet
    const missingNodes = await collection.find({ registrarWallet: { $exists: false } }).toArray();
    console.log(`Checking ${missingNodes.length} nodes for registration data...`);

    let found = 0;
    let checked = 0;

    for (const node of missingNodes) {
        checked++;
        if (checked % 20 === 0) process.stdout.write('.');

        try {
            const nodePubkey = new PublicKey(node.pubkey || node.publicKey || '');

            // Derive Registry PDA
            const [registryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), nodePubkey.toBuffer()],
                DEVNET_PROGRAM
            );

            const accountInfo = await conn.getAccountInfo(registryPDA);

            if (accountInfo && accountInfo.data.length >= 40) {
                // Found one! It WAS registered but we missed it?
                const registrarWallet = new PublicKey(accountInfo.data.slice(8, 40)).toBase58();

                if (registrarWallet !== '11111111111111111111111111111111') {
                    console.log(`\n✅ Found registration for ${node.pubkey}: ${registrarWallet}`);

                    await collection.updateOne(
                        { _id: node._id },
                        {
                            $set: {
                                registrarWallet,
                                isRegistered: true
                            }
                        }
                    );
                    found++;
                }
            }
        } catch (e) {
            // Invalid pubkey or other error
        }
    }

    console.log(`\n\nDone! Found ${found} missed registrations out of ${missingNodes.length} nodes checked.`);
    process.exit(0);
}

lookupMissing();
