
import { Connection, PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';

const XAND_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VSR_PROGRAM_ID = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

async function main() {
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=2aca1e9b-9f51-44a0-938b-89dc6c23e9b4');
    const proposalId = new PublicKey('GtATQH4WBWRRheTBVmm3WWiiomnAE3uaP2ff6crYLwhg');

    console.log(`Inspecting proposal: ${proposalId.toBase58()}`);

    const accounts = await connection.getProgramAccounts(XAND_GOV_PROGRAM, {
        filters: [
            { memcmp: { offset: 1, bytes: proposalId.toBase58() } }
        ]
    });

    for (const acc of accounts) {
        const data = acc.account.data;
        // Search for VSR Program ID in the instruction sections
        // SPL Governance ProposalTransactionV2 structure roughly:
        // [0] AccountType (1)
        // [1-32] Proposal (32)
        // [33] Instruction Index (2, le)
        // [35] Option Index (1)
        // [36] Hold up time (4, le)
        // [40] Instruction (variable)

        // Let's try to find the VSR program ID offset
        const vsrOffset = data.indexOf(VSR_PROGRAM_ID.toBuffer());
        if (vsrOffset !== -1) {
            console.log(`Found VSR at offset ${vsrOffset}`);
            // The instruction structure is likely:
            // program_id (32)
            // accounts (vector)
            // data (vector)

            // In spl-governance, it's InstructionData:
            // program_id: Pubkey
            // accounts: Vec<AccountMetaData>
            // data: Vec<u8>

            const instructionData = data.slice(vsrOffset);
            const programId = new PublicKey(instructionData.slice(0, 32));

            // Let's print some hex to see the structure
            console.log(`Data slice hex: ${instructionData.slice(0, 100).toString('hex')}`);

            // The accounts vec starts after the programId
            // A common pattern is: programId (32) | account_count (4, le) | ...accounts...
            const accountCount = instructionData.readUInt32LE(32);
            console.log(`Account count: ${accountCount}`);

            // Each account is Pubkey (32) + is_signer (1) + is_writable (1) = 34 bytes
            const accountsEnd = 36 + accountCount * 34; // 32 (pubkey) + 4 (len) + count * 34
            // Wait, Anchor/SPL Governance might use 4 byte len for vec

            // Let's look for the 'voter_authority' which is one of the accounts in Grant
            // In Grant instruction (from grant.rs line 10):
            // 0: registrar
            // 1: voter
            // 2: voter_authority (RECIPIENT)
            // ...

            const voterAuthorityOffset = 36 + 2 * 34; // 32 (pubkey) + 4 (len) + index 2 * 34
            if (instructionData.length > voterAuthorityOffset + 32) {
                const recipient = new PublicKey(instructionData.slice(voterAuthorityOffset, voterAuthorityOffset + 32));
                console.log(`Possible recipient (voter_authority): ${recipient.toBase58()}`);
            }

            // The instruction data (discriminator + args) starts after the accounts vec
            const dataLenOffset = 36 + accountCount * 34;
            const dataLen = instructionData.readUInt32LE(dataLenOffset);
            const vsrInstructionData = instructionData.slice(dataLenOffset + 4, dataLenOffset + 4 + dataLen);
            console.log(`VSR Instruction Data Hex: ${vsrInstructionData.toString('hex')}`);

            // Discriminator for "grant" is likely 8 bytes
            // args: voter_bump (1), voter_weight_record_bump (1), kind (1), start_ts (Option<u64>), periods (4), allow_clawback (1), amount (8)
            const amountOffset = vsrInstructionData.length - 8;
            if (amountOffset >= 0) {
                const amount = Number(vsrInstructionData.readBigUInt64LE(amountOffset)) / 1e9;
                console.log(`Amount: ${amount} XAND`);
            }
        }
    }
}

main().catch(console.error);
