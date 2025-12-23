import { config } from 'dotenv';
config();
import { MongoClient } from 'mongodb';
import { storeHistoricalSnapshot } from './lib/server/mongodb-history';

async function triggerSnapshot() {
  console.log('🔄 Triggering manual snapshot creation...');

  const client = new MongoClient(process.env.MONGODB_URI || '');
  try {
    await client.connect();
    const db = client.db('xandeum_analytics');
    const nodesCollection = db.collection('nodes');

    const nodes = await nodesCollection.find({}).toArray();
    console.log(`📊 Found ${nodes.length} nodes in database`);

    if (nodes.length > 0) {
      const pNodes = nodes.map((n: any) => ({
        ...n,
        pubkey: n.pubkey || n._id?.toString(),
      }));

      await storeHistoricalSnapshot(pNodes as any);
      console.log('✅ Snapshot created successfully');

      const historyCollection = db.collection('node_history');
      const count = await historyCollection.countDocuments();
      console.log(`📈 Total snapshots now: ${count}`);

      const latest = await historyCollection.findOne({}, { sort: { timestamp: -1 } });
      if (latest) {
        console.log(`\n🎯 Latest snapshot:`);
        console.log(`  Timestamp: ${new Date(latest.timestamp).toISOString()}`);
        console.log(`  Health Score: ${latest.networkHealthScore}`);
        console.log(`  Availability: ${latest.networkHealthAvailability}`);
        console.log(`  Version Health: ${latest.networkHealthVersion}`);
        console.log(`  Distribution: ${latest.networkHealthDistribution}`);
      }
    } else {
      console.log('❌ No nodes found in database');
    }
  } finally {
    await client.close();
  }
}

triggerSnapshot().catch(console.error);
