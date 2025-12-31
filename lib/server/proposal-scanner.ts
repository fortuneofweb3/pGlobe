
import { Connection, PublicKey } from '@solana/web3.js';
import { SimpleCache } from './cache-utils';

const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const XAND_GOV_PROGRAM = new PublicKey('4ruGZqLoPVKX27Qm91Qjsqt5AzCtLrhmjKT8ubwHiVZu');
const VSR_PROGRAM_ID = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

const proposalMappingCache = new SimpleCache<Map<string, string>>(15); // 15 mins cache

export async function getProposalMapping(): Promise<Map<string, string>> {
    const cached = proposalMappingCache.get('mapping');
    if (cached) return cached;

    const connection = new Connection(RPC_URL, 'confirmed');
    const mapping = new Map<string, string>();

    try {
        console.log('[ProposalScanner] Scanning for DAO Grant Proposals...');
        const allAccounts = await connection.getProgramAccounts(XAND_GOV_PROGRAM);

        for (const { account } of allAccounts) {
            const data = account.data;

            const vsrOffset = data.indexOf(VSR_PROGRAM_ID.toBuffer());
            if (vsrOffset === -1) continue;

            if (data.length < 33) continue;
            const proposalId = new PublicKey(data.slice(1, 33)).toBase58();

            const instructionData = data.slice(vsrOffset);
            if (instructionData.length < 40) continue;

            const accountCount = instructionData.readUInt32LE(32);
            if (accountCount < 3) continue;

            const voterAuthorityOffset = 36 + 2 * 34;
            if (instructionData.length < voterAuthorityOffset + 32) continue;

            const recipient = new PublicKey(instructionData.slice(voterAuthorityOffset, voterAuthorityOffset + 32)).toBase58();

            const dataLenOffset = 36 + accountCount * 34;
            if (instructionData.length < dataLenOffset + 4) continue;

            const dataLen = instructionData.readUInt32LE(dataLenOffset);
            const vsrInstructionData = instructionData.slice(dataLenOffset + 4, dataLenOffset + 4 + dataLen);

            // args: voter_bump(1), voter_weight_record_bump(1), kind(1), start_ts(Option<u64>), periods(4), allow_clawback(1), amount(8)
            // Option<u64> = 1 byte tag + 8 byte value
            if (vsrInstructionData.length < 24) continue;

            let startTs = 0;
            const hasStartTs = vsrInstructionData[11]; // Offset 8 (disc) + 1 + 1 + 1 = 11
            if (hasStartTs === 1) {
                startTs = Number(vsrInstructionData.readBigUInt64LE(12));
            }

            const amountRaw = vsrInstructionData.readBigUInt64LE(vsrInstructionData.length - 8);
            const amountXand = Number(amountRaw) / 1e9;

            // Mapping key: recipient:amount:startTs
            // Use set to allow multiple proposals for same recipient (rare but possible)
            // Actually, we'll just use the latest one we find
            const mappingKey = `${recipient}:${amountXand.toFixed(0)}:${startTs}`;
            mapping.set(mappingKey, proposalId);

            // Also store a fallback without startTs if needed
            const fallbackKey = `${recipient}:${amountXand.toFixed(0)}`;
            if (!mapping.has(fallbackKey)) {
                mapping.set(fallbackKey, proposalId);
            }
        }

        console.log(`[ProposalScanner] Mapping built with ${mapping.size} keys`);
        proposalMappingCache.set('mapping', mapping);
        return mapping;

    } catch (err) {
        console.error('[ProposalScanner] Error building proposal mapping:', err);
        return mapping;
    }
}
