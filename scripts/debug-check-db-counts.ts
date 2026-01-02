
import { getNodesCollection } from '../lib/server/mongodb-nodes';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
    const db = await getNodesCollection();

    const wallets = [
        '3E1MAZzMV69yXwtZFy9cSTSByVMXGCSasitCNtRX5UxT', // Expected: 4 (from 0x0403)
        'sHokok1QWtQePa9vHeA5dXzB2PrFaPfxzth6s2hvXwa',   // Expected: 2 (from 0x0201)
        '4WrU8MtaA3sgNyqUzvXqDb2VW7dvwTF6P9tck2mAGAyr', // Expected: 3 (from 0x0300)
        'BhwBYNG7TwUBm6W2t38ng8BjKJRrUG7d785bW2NnUZdU'  // Expected: 1 (from 0x0101)
    ];

    for (const wallet of wallets) {
        const count = await db.countDocuments({
            $or: [{ managerWallet: wallet }, { registrarWallet: wallet }]
        });
        console.log(`Wallet ${wallet.slice(0, 8)}...: ${count} nodes`);
    }

    process.exit(0);
}

main();
