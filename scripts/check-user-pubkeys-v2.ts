
import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_PUBKEYS = [
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ',
    '7EBHmaFGFgiCV4SM4vPGjNbPB1BWMStBSKo28xg7p6bY' // Known mainnet node
];

async function main() {
    console.log(`Checking ${TARGET_PUBKEYS.length} pubkeys...`);

    // 1. Read Credits JSON (Mainnet)
    console.log('Reading credits_mainnet.json...');
    const creditsPath = path.join(process.cwd(), 'scripts', 'credits_mainnet.json');
    let creditsMap = new Map();

    try {
        const raw = fs.readFileSync(creditsPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.pods_credits) {
            for (const p of data.pods_credits) {
                creditsMap.set(p.pod_id, p.credits);
            }
        }
        console.log(`Loaded ${creditsMap.size} pods from MAINNET credits API file.`);
    } catch (e) {
        console.error('Failed to read credits_mainnet.json:', e);
    }

    // 2. Fetch On-Chain Data
    console.log('Fetching On-Chain Data (Mainnet Helius Check)...');

    const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    // CORRECT MAINNET PROGRAM ID found in manager-discovery.ts
    const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
    const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

    console.log(`Checking Index Account ${INDEX_ACCOUNT.toBase58()} on Mainnet...`);
    const indexInfo = await connection.getAccountInfo(INDEX_ACCOUNT);
    if (indexInfo) {
        console.log(`✅ Index Account Found. Data Length: ${indexInfo.data.length} bytes`);
    } else {
        console.log(`❌ Index Account NOT FOUND on Mainnet.`);
    }

    for (const pubkey of TARGET_PUBKEYS) {
        console.log(`\n---------------------------------------------------`);
        console.log(`Pubkey: ${pubkey}`);

        // Credits
        const credits = creditsMap.get(pubkey);
        if (credits !== undefined) {
            console.log(`✅ Credits API: ${credits} credits`);
        } else {
            console.log(`❌ Credits API: Not found`);
        }

        // On-Chain
        try {
            console.log('Querying on-chain details...');

            const nodePubkey = new PublicKey(pubkey);
            const [registryAddress] = PublicKey.findProgramAddressSync([Buffer.from('registry'), nodePubkey.toBuffer()], MAINNET_PROGRAM);
            const [managerAddress] = PublicKey.findProgramAddressSync([Buffer.from('manager'), nodePubkey.toBuffer()], MAINNET_PROGRAM);

            const [balanceRes, regRes, manRes] = await Promise.allSettled([
                connection.getBalance(nodePubkey),
                connection.getAccountInfo(registryAddress),
                connection.getAccountInfo(managerAddress)
            ]);

            const balance = balanceRes.status === 'fulfilled' ? balanceRes.value / 1e9 : 0;
            const regData = regRes.status === 'fulfilled' ? regRes.value : null;

            if (regData) {
                console.log(`✅ On-Chain Info Found (Registered!):`);
                console.log(`   - Balance: ${balance} SOL`);
                console.log(`   - Registered: YES`);

                const data = regData.data;
                // Parse Logic
                let registrarWallet = 'Unknown';
                if (data.length >= 41) registrarWallet = new PublicKey(data.slice(9, 41)).toBase58();

                let managerWallet = 'Unknown';
                if (data.length >= 74) {
                    const potentialOwner = new PublicKey(data.slice(42, 74)).toBase58();
                    if (potentialOwner !== '11111111111111111111111111111111') managerWallet = potentialOwner;
                }

                // Fallback to Manager PDA for wallet
                if (managerWallet === 'Unknown' && manRes.status === 'fulfilled' && manRes.value) {
                    if (manRes.value.data.length >= 32) {
                        managerWallet = new PublicKey(manRes.value.data.slice(0, 32)).toBase58();
                    }
                }

                console.log(`   - Manager Wallet: ${managerWallet}`);
                console.log(`   - Registrar Wallet: ${registrarWallet}`);

                // Era Logic
                const regEraId = data.readUInt16LE(32);
                const byte8 = data[8];
                let eraId = 1;
                if (regEraId > 1 && regEraId <= 14) eraId = regEraId;
                else if (byte8 > 0 && byte8 <= 14) eraId = byte8;

                console.log(`   - Era ID: ${eraId}`);

            } else {
                console.log(`⚠️ On-Chain Info Found (But Unregistered):`);
                console.log(`   - Balance: ${balance} SOL`);
                console.log(`   - Registered: NO (Registry Account not found at ${registryAddress.toBase58()})`);
            }

        } catch (e: any) {
            console.log(`❌ Failed to fetch on-chain data: ${e.message}`);
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
