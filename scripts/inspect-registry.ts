
import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function inspectRegistry() {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    console.log('Fetching pNode index account...');
    const accountInfo = await connection.getAccountInfo(INDEX_ACCOUNT);

    if (!accountInfo || !accountInfo.data) {
        console.warn('Index account not found or has no data');
        return;
    }

    const accountData = accountInfo.data;
    const pubkeys: string[] = [];
    const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

    for (let i = 0; i < accountData.length && pubkeys.length < 10; i += 32) {
        const pubkey = new PublicKey(accountData.slice(i, i + 32));
        if (!pubkey.equals(DEFAULT_PUBKEY)) {
            pubkeys.push(pubkey.toBase58());
        }
    }

    console.log(`Checking first ${pubkeys.length} nodes for Registry PDA...`);

    for (const nodePubkeyStr of pubkeys) {
        const nodePubkey = new PublicKey(nodePubkeyStr);
        const [registryAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('registry'), nodePubkey.toBuffer()],
            DEVNET_PROGRAM
        );

        const regAccount = await connection.getAccountInfo(registryAddress);
        if (regAccount) {
            console.log(`\n--- Node: ${nodePubkeyStr} ---`);
            console.log(`Registry Address: ${registryAddress.toBase58()}`);
            console.log(`Data Length: ${regAccount.data.length} bytes`);

            const data = regAccount.data;
            console.log(`Hex (first 200 bytes):`);
            const hex = data.toString('hex');
            for (let i = 0; i < Math.min(hex.length, 400); i += 64) {
                console.log(`Offset ${i / 2}: ${hex.slice(i, Math.min(i + 64, 400))}`);
            }

            // Scan for Registrar
            const registrar = new PublicKey('Buh3TTHXy262Z6YBaC8gRt6NDEF1eKeWhRDNNs8HR7EP'); // Sample known registrar
            const registrar2 = new PublicKey('7bnpqvPuaS7rcajSgRqcJAxaYeGBCY1kJysVocQGAqDH');
            const regBuf = registrar.toBuffer();
            const regBuf2 = registrar2.toBuffer();

            const foundAt = data.indexOf(regBuf);
            const foundAt2 = data.indexOf(regBuf2);
            if (foundAt >= 0) console.log(`!!! Registrar 1 found at offset ${foundAt}`);
            if (foundAt2 >= 0) console.log(`!!! Registrar 2 found at offset ${foundAt2}`);

            // Try to parse what we observe
            if (data.length >= 34) {
                const version = data.readUInt16LE(32);
                const price = data.readBigUInt64LE(34);
                console.log(`Parsed: Version=${version}, Price=${Number(price) / 1e9} SOL`);
            }
            if (data.length >= 74) {
                const manager = new PublicKey(data.slice(42, 74));
                console.log(`Parsed: Manager (42-74)=${manager.toBase58()}`);
            }

            // Look for Registrar at common offsets
            if (data.length >= 106) {
                const r1 = new PublicKey(data.slice(74, 106));
                console.log(`Potential Registrar (74-106): ${r1.toBase58()}`);
            }
        }
    }
}

inspectRegistry().catch(console.error);
