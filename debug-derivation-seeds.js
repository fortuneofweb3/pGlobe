const { Connection, PublicKey } = require('@solana/web3.js');

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

// Known link from `node-wallet-mappings.json`
const CHECK_NODE = new PublicKey('6PbJSbfG4pMneMoizZFNEfNkmBrL6frenKmDbqbBDcKq');
const CHECK_WALLET = new PublicKey('4Ud8eU6dR6CGGAgrTJB2aVrsf3bce7eQyDZ1gRLTHNcn');

async function checkDerivations() {
    const devConn = new Connection(DEVNET_RPC, 'confirmed');
    const mainConn = new Connection(MAINNET_RPC, 'confirmed');

    console.log('--- Testing Derivations ---');
    console.log(`Node: ${CHECK_NODE.toBase58()}`);
    console.log(`Wallet: ${CHECK_WALLET.toBase58()}`);

    const scenarios = [
        { network: 'Devnet', conn: devConn, program: DEVNET_PROGRAM, seedType: 'Node', seedKey: CHECK_NODE },
        { network: 'Devnet', conn: devConn, program: DEVNET_PROGRAM, seedType: 'Wallet', seedKey: CHECK_WALLET },
        { network: 'Mainnet', conn: mainConn, program: MAINNET_PROGRAM, seedType: 'Node', seedKey: CHECK_NODE },
        { network: 'Mainnet', conn: mainConn, program: MAINNET_PROGRAM, seedType: 'Wallet', seedKey: CHECK_WALLET },
    ];

    for (const scen of scenarios) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('manager'), scen.seedKey.toBuffer()],
            scen.program
        );

        console.log(`\nChecking ${scen.network} | Seed: ${scen.seedType} | PDA: ${pda.toBase58()}`);
        const info = await scen.conn.getAccountInfo(pda);
        if (info) {
            console.log(`[FOUND] Data Len: ${info.data.length}`);
            if (info.data.length >= 32) {
                const auth = new PublicKey(info.data.slice(0, 32)).toBase58();
                console.log(`  -> First 32 bytes (Auth/Wallet): ${auth}`);
            }
        } else {
            console.log(`[NOT FOUND]`);
        }
    }
}

checkDerivations().catch(console.error);
