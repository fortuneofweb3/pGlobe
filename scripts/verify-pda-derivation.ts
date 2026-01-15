
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL');
const WALLET = new PublicKey('Ec3nzEVcQ7jxgJWoHF9eECa2ysyjK95h6agNQVesNXnK');

const TARGETS = [
    '79xFAcGDxD8vcPy1uW55BajrsucToShRU8JDinVXkXFN', // Account [1]
    '2TL9ZxNwKbg5Qu8n5TJDJUBqtxLXRR666TXsF8ZVk6L4'  // Account [2]
];

function check(name, seeds) {
    const [pda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
    console.log(`${name.padEnd(15)}: ${pda.toBase58()}`);
    if (TARGETS.includes(pda.toBase58())) {
        console.log(`  ✅ MATCH FOUND: ${pda.toBase58()} is ${name} (Account [${TARGETS.indexOf(pda.toBase58()) + 1}])`);
    }
}

console.log('--- Checking PDA Derivations ---');
console.log(`Program: ${PROGRAM_ID}`);
console.log(`Wallet : ${WALLET}`);

check('registry', [Buffer.from('registry'), WALLET.toBuffer()]);
check('manager', [Buffer.from('manager'), WALLET.toBuffer()]);
check('global', [Buffer.from('global')]);
check('pnode', [Buffer.from('pnode'), WALLET.toBuffer()]);
check('registrar', [Buffer.from('registrar'), WALLET.toBuffer()]);
check('owner', [Buffer.from('owner'), WALLET.toBuffer()]);
check('config', [Buffer.from('config')]);
check('state', [Buffer.from('state')]);
check('treasury', [Buffer.from('treasury')]);
check('bank', [Buffer.from('bank')]);
check('vault', [Buffer.from('vault')]);
check('fee', [Buffer.from('fee')]);
check('fee_vault', [Buffer.from('fee_vault')]);
check('fees', [Buffer.from('fees')]);
check('deposit', [Buffer.from('deposit')]);
check('info', [Buffer.from('info')]);
check('settings', [Buffer.from('settings')]);
check('admin', [Buffer.from('admin')]);
// Maybe it's derived with just the word "owner"? (Checked above with wallet, but maybe global owner list?)
check('global_owner', [Buffer.from('owner')]);
