
import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const TARGET_WALLET = new PublicKey('5qRv3m3xfrpHQZsrNuoam78j7BZ5eWgzRsvkdRbrhK7W');
const XAND_MINT = new PublicKey('XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

async function getATA(owner: PublicKey, mint: PublicKey): Promise<PublicKey> {
    const [ata] = PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
        ATA_PROGRAM
    );
    return ata;
}

async function traceXand() {
    const connection = new Connection(MAINNET_RPC, 'confirmed');

    const ata = await getATA(TARGET_WALLET, XAND_MINT);
    console.log(`XAND ATA for ${TARGET_WALLET.toBase58()}: ${ata.toBase58()}`);

    // Check if exists
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
        console.log('ATA does not exist. Wallet has no XAND.');
        return;
    }

    // Get balance via parsed query
    const balance = await connection.getTokenAccountBalance(ata);
    console.log(`XAND Balance: ${balance.value.uiAmount}`);

    // Get signatures for ATA
    const sigs = await connection.getSignaturesForAddress(ata, { limit: 5 });
    console.log(`Found ${sigs.length} transactions for XAND ATA.\n`);

    for (const sig of sigs) {
        console.log(`Signature: ${sig.signature}`);
        console.log(`   Time: ${new Date((sig.blockTime || 0) * 1000).toISOString()}`);

        try {
            const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx) continue;

            // Find all unique programs
            const programs = new Set<string>();
            for (const ix of tx.transaction.message.instructions) {
                if ('programId' in ix) {
                    programs.add(ix.programId.toString());
                }
            }

            // Include CPI
            for (const inner of tx.meta?.innerInstructions || []) {
                for (const ix of inner.instructions) {
                    if ('programId' in ix) {
                        programs.add(ix.programId.toString());
                    }
                }
            }

            // Don't print standard programs
            const custom = [...programs].filter(p =>
                !p.includes('1111111111') &&
                !p.includes('TokenkegQfe') &&
                !p.includes('ATokenGPv')
            );

            if (custom.length > 0) {
                console.log(`   🎯 Custom Programs: ${custom.join(', ')}`);
            } else {
                console.log(`   Standard Token Transfer (no custom program)`);
            }

        } catch (e) {
            console.log(`   Error parsing tx: ${e}`);
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 500));
    }
}

traceXand().catch(console.error);
