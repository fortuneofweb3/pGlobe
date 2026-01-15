
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const MAINNET_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const connection = new Connection(MAINNET_RPC, 'confirmed');

const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const LEAKED_PUBKEY = 'FvcA3xNQAhULxwhJZbFths87CgBVDW4qPTjVLV9CJEwD';

async function checkAuthority() {
    console.log(`Checking Upgrade Authority for Program: ${MAINNET_PROGRAM.toBase58()}`);

    const accountInfo = await connection.getAccountInfo(MAINNET_PROGRAM);
    if (!accountInfo) {
        console.log('Program account not found?');
        return;
    }

    // Program accounts are executable. The "upgrade authority" is stored in the "ProgramData" account.
    // The Program account has a pointer to the ProgramData account.
    // However, it's easier to fetch the ProgramData account directly if we knwo the address, 
    // or just checking the BPF Loader Upgradeable logic.
    // Standard approach: Get parsed account info.

    // Actually, a clearer way for "BPF Loader 2" / "BPF Upgradeable Loader":
    // The program account's owner is the BPF Loader.
    // If it's Upgradeable, there is a separate ProgramData account.

    // Let's use getParsedAccountInfo
    const parsed = await connection.getParsedAccountInfo(MAINNET_PROGRAM);
    console.log('Program Owner:', parsed.value?.owner.toBase58());

    // Get Program Data Address
    let programDataAddress: PublicKey | null = null;

    if (parsed.value?.data && 'parsed' in parsed.value.data) {
        const info = parsed.value.data.parsed.info;
        console.log(`ProgramData Address (from info): ${info.programData}`);
        if (info.programData) {
            programDataAddress = new PublicKey(info.programData);
        }
    }

    // Fallback to derivation if not found in info
    if (!programDataAddress) {
        const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
        const [derivedAddress] = PublicKey.findProgramAddressSync(
            [MAINNET_PROGRAM.toBuffer()],
            BPF_LOADER_UPGRADEABLE
        );
        programDataAddress = derivedAddress;
        console.log(`ProgramData Address (derived): ${programDataAddress.toBase58()}`);
    }

    if (programDataAddress) {
        console.log(`Fetching ProgramData from ${programDataAddress.toBase58()}...`);
        const programData = await connection.getParsedAccountInfo(programDataAddress);

        if (programData.value?.data && 'parsed' in programData.value.data) {
            const info = programData.value.data.parsed.info;
            console.log(`Authority: ${info.authority}`);

            if (info.authority === LEAKED_PUBKEY) {
                console.log(`\n🚨 🚨 🚨 MATCH! The Leaked Key IS the Upgrade Authority! 🚨 🚨 🚨`);
            } else {
                console.log(`\n✅ Leaked Key (${LEAKED_PUBKEY}) is NOT the Upgrade Authority.`);
                console.log(`Actual Authority: ${info.authority}`);
            }
        } else {
            console.log('Could not parse ProgramData account.');
        }
    }

    // CHECK DEVNET PROGRAM
    console.log(`\n---------------------------------------------------`);
    console.log(`Checking Upgrade Authority for DEVNET Program: 6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL`);
    const devnetParams = {
        commitment: 'confirmed'
    };
    // fetch raw account info from devnet
    // Manually fetch because we established connection as mainnet only above
    // Re-using fetch or axios for speed or just new connection
    const devnetConn = new Connection('https://api.devnet.solana.com', 'confirmed');
    const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

    // BPF Upgradeable stored in ProgramData account
    const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
    const [devnetProgramDataAddress] = PublicKey.findProgramAddressSync(
        [DEVNET_PROGRAM.toBuffer()],
        BPF_LOADER_UPGRADEABLE
    );

    const devProgramData = await devnetConn.getParsedAccountInfo(devnetProgramDataAddress);
    if (devProgramData.value?.data && 'parsed' in devProgramData.value.data) {
        const info = devProgramData.value.data.parsed.info;
        console.log(`Devnet Program Authority: ${info.authority}`);
        if (info.authority === LEAKED_PUBKEY) {
            console.log(`\n🚨 🚨 🚨 MATCH! The Leaked Key IS the DEVNET Authority! 🚨 🚨 🚨`);
        } else {
            console.log(`\n✅ Leaked Key is NOT the Devnet Authority.`);
        }
    } else {
        console.log(`Could not fetch/parse Devnet ProgramData.`);
    }

}

checkAuthority();
