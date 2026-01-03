import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'pGlobe');
    
    const nodes = await db.collection('nodes').find({ 
      mainnetCredits: { $gt: 0 },
      $or: [{ devnetCredits: 0 }, { devnetCredits: null }]
    }).toArray();
    
    console.log('STRICTLY_MAINNET_NODES_IN_DB: ' + nodes.length);
    if (nodes.length > 0) {
      const onlineNode = nodes.find(n => n.status === 'online') || nodes[0];
      console.log('SELECTED_NODE_PUBKEY: ' + onlineNode.pubkey);
      console.log('SELECTED_NODE_ADDRESS: ' + onlineNode.address);
      console.log('SELECTED_NODE_VERSION: ' + onlineNode.version);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
run();
