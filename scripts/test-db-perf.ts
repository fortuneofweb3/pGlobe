import { getNodesByManager } from '../lib/server/mongodb-nodes';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const wallet = '7KpfdgMiUCmQsAyeThZkCokyXWxJkVTdQsnFhKzMxzWN';
    console.log(`Starting benchmark for ${wallet}...`);
    
    const start1 = Date.now();
    const nodes1 = await getNodesByManager(wallet);
    console.log(`First query: ${nodes1.length} nodes in ${Date.now() - start1}ms`);
    
    const start2 = Date.now();
    const nodes2 = await getNodesByManager(wallet);
    console.log(`Second query (connection reused): ${nodes2.length} nodes in ${Date.now() - start2}ms`);
    
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
