import { Connection, PublicKey } from '@solana/web3.js';

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const MAINNET_PROGRAM = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');

async function inspectV2() {
    const conn = new Connection(MAINNET_RPC, 'confirmed');

    // We need to find a known "Buy" transaction to analyze.
    // Analyzing random recent TXs is noisy (upgrades, etc).
    // Let's find a transaction that created one of our known Purchase Accounts.
    // We found 142 purchase accounts earlier. Let's pick one and find its creation signature.

    const knownPurchaseAccount = new PublicKey('CaQ6UBEyLPhBJFYSBeV1htxTi6H7KKHk9fjBhuK8XuSc'); // From previous step

    console.log(`Fetching creation history for known Purchase Account: ${knownPurchaseAccount.toBase58()}`);

    const signatures = await conn.getSignaturesForAddress(knownPurchaseAccount, { limit: 10 });
    // The oldest signature should be the creation (Buy) transaction
    const creationSig = signatures[signatures.length - 1];

    console.log(`Creation Signature: ${creationSig.signature}`);

    const tx = await conn.getTransaction(creationSig.signature, {
        maxSupportedTransactionVersion: 0
    });

    if (!tx) {
        console.log('TX not found.');
        return;
    }

    console.log('\n--- Transaction Analysis ---');
    console.log('Logs:', tx.meta?.logMessages);

    const accountKeys = tx.transaction.message.staticAccountKeys;
    console.log(`\nInvolved Accounts (${accountKeys.length}):`);
    accountKeys.forEach((k, i) => {
        console.log(`[${i}] ${k.toBase58()} ${k.equals(knownPurchaseAccount) ? '<-- THIS IS THE PURCHASE ACCOUNT' : ''}`);
    });

    // Logic: 
    // If the user submits a Node Pubkey to "Buy" it, that Pubkey MUST be in this list.
    // It won't be the Purchase Account itself (which is 48 bytes).
    // It won't be the System Program, Token Program, etc.
    // It might be a signer (if pNode generates the key?) or just a passed address.

    console.log('\nScanning for potential Node Pubkeys in this list...');
    // A pNode pubkey is just a random Ed25519 key. 
    // We can't know for sure without the instruction data decoding.

    // Let's dump the instruction data for the instruction that calls our Program
    const instructions = tx.transaction.message.compiledInstructions;
    instructions.forEach((ix, i) => {
        const programId = accountKeys[ix.programIdIndex];
        if (programId.equals(MAINNET_PROGRAM)) {
            console.log(`\nInstruction #${i} call to Purchase Program:`);
            console.log(`Data (Hex): ${Buffer.from(ix.data).toString('hex')}`);
            // Does the data contain a 32-byte pubkey?
            // Instruction data usually: [Discriminator (8 bytes)] + [Arguments]
            if (ix.data.length > 8) {
                const args = Buffer.from(ix.data.slice(8));
                console.log(`Arguments Hex: ${args.toString('hex')}`);
                if (args.length >= 32) {
                    const potentialPubkey = new PublicKey(args.slice(0, 32));
                    console.log(`Potential Node Pubkey Argument: ${potentialPubkey.toBase58()}`);
                }
            }
        }
    });

    process.exit(0);
}

inspectV2();
