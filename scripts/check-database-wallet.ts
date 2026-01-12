
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check(wallet: string) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not found in .env.local');
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
        const coll = db.collection('nodes');

        console.log(`Checking database for wallet: ${wallet}`);

        // Find nodes where wallet is manager or registrar
        const nodes = await coll.find({
            $or: [
                { managerWallet: wallet },
                { registrarWallet: wallet }
            ]
        }).toArray();

        console.log(`Found ${nodes.length} nodes associated with this wallet.`);

        if (nodes.length > 0) {
            console.log('--- Nodes ---');
            nodes.forEach(n => {
                console.log(`IP: ${n._id || n.address}, Pubkey: ${n.pubkey}, Network: ${n.network}, status: ${n.status}`);
                console.log(`  DAO Stake: ${n.daoStake} XAND, Vesting Stake: ${n.vestingStake} XAND`);
            });
        }

        // Check manager_rewards collection
        const reward = await db.collection('manager_rewards').findOne({ managerWallet: wallet });
        if (reward) {
            console.log('\n--- Manager Rewards ---');
            console.log(`Manager Wallet: ${reward.managerWallet}`);
            console.log(`Total Rewards: ${reward.totalRewards} XAND`);
            console.log(`History points: ${reward.history?.length || 0}`);
            if (reward.history && reward.history.length > 0) {
                console.log('Sample History Item:', JSON.stringify(reward.history[0], null, 2));
            }
        } else {
            console.log('\nNo document found in manager_rewards for this wallet.');
        }

    } catch (err) {
        console.error('Database query error:', err);
    } finally {
        await client.close();
    }
}

const walletArg = process.argv[2] || 'CYxrrpDtELXmP5u5CBSA2KWaWzov2VmF5aRFJdGRLuVy';
check(walletArg);
