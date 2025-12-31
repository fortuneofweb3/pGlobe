import { Connection, PublicKey } from '@solana/web3.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');

async function run() {
    const conn = new Connection('https://api.devnet.xandeum.com:8899');
    const accounts = await conn.getProgramAccounts(DEVNET_PROGRAM, {
        filters: [{ dataSize: 1040 }]
    });

    // Get all prices and sort them
    const prices = accounts.map(acc => ({
        pubkey: acc.pubkey.toBase58(),
        price: acc.account.data.readUInt16LE(34)
    })).sort((a, b) => b.price - a.price); // Descending (highest=oldest/earliest)

    console.log('=== PRICE DISTRIBUTION ANALYSIS ===\n');
    console.log(`Total nodes: ${prices.length}`);
    console.log(`Price range: ${prices[prices.length - 1].price} to ${prices[0].price}\n`);

    // Divide into 30 brackets (for 30 milestones)
    const bracketsCount = 30;
    const nodesPerBracket = Math.floor(prices.length / bracketsCount);

    console.log(`Dividing into ${bracketsCount} milestone brackets (~${nodesPerBracket} nodes each):\n`);

    for (let i = 0; i < bracketsCount; i++) {
        const start = i * nodesPerBracket;
        const end = i === bracketsCount - 1 ? prices.length : (i + 1) * nodesPerBracket;
        const bracket = prices.slice(start, end);

        const minPrice = Math.min(...bracket.map(p => p.price));
        const maxPrice = Math.max(...bracket.map(p => p.price));
        const avgPrice = Math.round(bracket.reduce((sum, p) => sum + p.price, 0) / bracket.length);

        console.log(`Milestone ${i + 1}: ${bracket.length} nodes, price ${minPrice}-${maxPrice} (avg ${avgPrice})`);
    }

    console.log('\n\n=== PROPOSED PRICE-TO-MILESTONE MAPPING ===');
    console.log('Based on natural price distribution, use these ranges:\n');

    // Create clean brackets
    const priceStep = (prices[0].price - prices[prices.length - 1].price) / bracketsCount;
    for (let i = 0; i < bracketsCount; i++) {
        const minPrice = Math.round(prices[prices.length - 1].price + (i * priceStep));
        const maxPrice = Math.round(prices[prices.length - 1].price + ((i + 1) * priceStep));
        console.log(`if (price >= ${minPrice} && price < ${maxPrice}) milestone = ${i + 1};`);
    }
}

run().catch(console.error);
