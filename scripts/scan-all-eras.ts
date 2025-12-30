import { Connection, PublicKey } from '@solana/web3.js';
import { fetchPNodesFromOnChain } from '../lib/server/solana-pnodes';

const XANDEUM_DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';

async function scanAllEras() {
    const connection = new Connection(XANDEUM_DEVNET_RPC, 'confirmed');

    console.log('Fetching all node pubkeys...');
    const pubkeys = await fetchPNodesFromOnChain();
    console.log(`Found ${pubkeys.length} nodes. Fetching registry PDAs...`);

    const stats = {
        versions: {} as Record<number, number>,
        prices: {} as Record<string, number>,
        examples: {} as Record<string, string[]>,
        nullAccounts: 0,
        shortData: 0
    };

    const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

    // Batch fetch account infos
    const batchSize = 100;
    for (let i = 0; i < pubkeys.length; i += batchSize) {
        const batch = pubkeys.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(pubkeys.length / batchSize)}...`);

        const registryPDAs = batch.map(pk => {
            const [pda] = PublicKey.findProgramAddressSync(
                [Buffer.from('registry'), new PublicKey(pk).toBuffer()],
                DEVNET_PROGRAM
            );
            return pda;
        });

        const accounts = await connection.getMultipleAccountsInfo(registryPDAs);

        accounts.forEach((acc, idx) => {
            if (!acc) {
                stats.nullAccounts++;
                return;
            }
            const data = acc.data;
            if (data.length < 34) {
                stats.shortData++;
                return;
            }

            const version = data.readUInt16LE(32);
            let price = 0;
            if (data.length >= 42) {
                price = Number(data.readBigUInt64LE(34)) / 1e9;
            }

            const pStr = price.toFixed(4);
            stats.versions[version] = (stats.versions[version] || 0) + 1;
            stats.prices[pStr] = (stats.prices[pStr] || 0) + 1;

            const key = `V${version}_P${pStr}`;
            if (!stats.examples[key]) stats.examples[key] = [];
            if (stats.examples[key].length < 3) stats.examples[key].push(batch[idx]);
        });
    }

    console.log('\n=== Era Distribution Summary ===');
    console.log('Total Nodes:', pubkeys.length);
    console.log('Null Accounts:', stats.nullAccounts);
    console.log('Short Data (<34b):', stats.shortData);
    console.log('Versions:', stats.versions);
    console.log('Prices:', stats.prices);
    console.log('\nExamples per Group:');
    Object.entries(stats.examples).forEach(([group, keys]) => {
        console.log(`${group}: ${keys.join(', ')}`);
    });
}

scanAllEras().catch(console.error);
