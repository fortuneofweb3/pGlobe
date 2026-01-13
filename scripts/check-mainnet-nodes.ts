
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { Connection, PublicKey } from '@solana/web3.js';

// Specific Nodes for BeXhN2...3EJF
const targetNodes = [
    '8hYohqvLZHnBSzYGS7yR4RqVdA9hZU48KmEsycY4qcCk',
    'G6pCyVYaWEnAPLkoHbei3Jyx4RHwE1Dj9ZiEPM5KfjYN',
    '7u2vPk5x4ymTTGFrDYJoTGGn8o3LuAMPQD3hMPweTSyd',
    'H4B1YQd8Rv6EGtXBdarsPCZX8JNjNnckK9bkhHZhfq91'
];

// Mainnet Program ID (from manager-discovery.ts)
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

async function main() {
    console.log(`Checking ${targetNodes.length} nodes on Mainnet (${MAINNET_RPC})...`);
    console.log(`Program ID: ${MAINNET_PROGRAM.toBase58()}`);

    const connection = new Connection(MAINNET_RPC, 'confirmed');

    for (const pubkey of targetNodes) {
        try {
            const pk = new PublicKey(pubkey);

            // Checks:
            // 1. Does the account exist?
            // 2. Is it owned by the Mainnet Program?
            // 3. Does it have a Registry PDA?

            const info = await connection.getAccountInfo(pk);

            if (info) {
                console.log(`\n[${pubkey}] EXISTS on Mainnet`);
                console.log(`- Owner: ${info.owner.toBase58()}`);
                console.log(`- Data Length: ${info.data.length}`);

                if (info.owner.toBase58() === MAINNET_PROGRAM.toBase58()) {
                    console.log(`- ✅ OWNED BY XANDEUM PROGRAM! (It IS a Mainnet Node)`);
                } else {
                    console.log(`- ❌ Owned by someone else`);
                }

                // Check Registry PDA
                const [registryAddress] = PublicKey.findProgramAddressSync(
                    [Buffer.from('registry'), pk.toBuffer()],
                    MAINNET_PROGRAM
                );
                const regInfo = await connection.getAccountInfo(registryAddress);
                if (regInfo) {
                    console.log(`- ✅ Has Registry PDA: ${registryAddress.toBase58()}`);
                } else {
                    console.log(`- ❌ No Registry PDA`);
                }

            } else {
                // Determine if it exists via Registry PDA even if the node account itself is just a system account (rare but possible for pNodes using system accounts as identity)
                const [registryAddress] = PublicKey.findProgramAddressSync(
                    [Buffer.from('registry'), pk.toBuffer()],
                    MAINNET_PROGRAM
                );
                const regInfo = await connection.getAccountInfo(registryAddress);
                if (regInfo) {
                    console.log(`\n[${pubkey}] Node Account NOT found, but REGISTRY PDA EXISTS!`);
                    console.log(`- ✅ Confirmed Mainnet Registration via PDA: ${registryAddress.toBase58()}`);
                } else {
                    console.log(`\n[${pubkey}] NOT FOUND on Mainnet (Neither Account nor Registry)`);
                }
            }

        } catch (e) {
            console.error(`Error checking ${pubkey}:`, e);
        }
    }
}

main();
