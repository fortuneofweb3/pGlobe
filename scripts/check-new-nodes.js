/**
 * Find out which nodes were added recently (189 -> 191)
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  process.exit(1);
}

async function checkNewNodes() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`\n✅ Connected to MongoDB\n`);
    
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 'pGlobe';
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    // Get total count
    const total = await collection.countDocuments({});
    console.log(`📊 Total nodes: ${total}\n`);
    
    // Get nodes sorted by when they were last updated (most recent first)
    const recentNodes = await collection.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray();
    
    console.log(`📅 10 Most Recently Updated Nodes:\n`);
    recentNodes.forEach((node, i) => {
      console.log(`${i + 1}. ${node.pubkey?.substring(0, 25)}...`);
      console.log(`   Address: ${node.address}`);
      console.log(`   Updated: ${node.updatedAt ? new Date(node.updatedAt).toISOString() : 'N/A'}`);
      console.log(`   Status: ${node.status || 'N/A'}`);
      console.log(`   Seen in gossip: ${node.seenInGossip}`);
      console.log('');
    });
    
    // Check if merge strategy has been deployed
    console.log(`\n🔍 Checking Merge Strategy Deployment:\n`);
    
    const withPrevAddresses = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    
    console.log(`   Nodes with previousAddresses: ${withPrevAddresses}`);
    
    if (withPrevAddresses > 0) {
      console.log(`   ✅ Merge strategy is ACTIVE!\n`);
      
      const examples = await collection.find({ 
        previousAddresses: { $exists: true, $ne: [] } 
      }).limit(5).toArray();
      
      console.log(`   Examples:`);
      examples.forEach((node, i) => {
        console.log(`   ${i + 1}. ${node.pubkey?.substring(0, 20)}...`);
        console.log(`      Current: ${node.address}`);
        console.log(`      Previous: ${node.previousAddresses.join(', ')}`);
      });
    } else {
      console.log(`   ⚠️  Merge strategy NOT applied yet`);
      console.log(`   Background refresh needs to run with new code`);
    }
    
    // Check the 3 new pubkeys at the reused IPs
    console.log(`\n\n🔍 Checking the 3 nodes at the reused IP addresses:\n`);
    
    const reusedIPNodes = [
      'HUpUjQGKeUM2LMvvs2ZVTvpyUVUSGaVppC7wsM87vc4g',
      '5Fss6wEvgRqJuqBGg9vMVPpVzXYBnqPc6fL6RXVX2FcK',
      'BjBQFBLnqVDZMBQprdpv7gpYaKcp1fXNeu8MBLfdETAU'
    ];
    
    for (const pubkey of reusedIPNodes) {
      const node = await collection.findOne({ pubkey });
      if (node) {
        console.log(`✅ ${pubkey.substring(0, 20)}...`);
        console.log(`   Address: ${node.address}`);
        console.log(`   Version: ${node.version || 'N/A'}`);
        console.log(`   Created: ${node.createdAt ? new Date(node.createdAt).toISOString() : 'N/A'}`);
        console.log(`   Updated: ${node.updatedAt ? new Date(node.updatedAt).toISOString() : 'N/A'}`);
        console.log('');
      }
    }
    
  } finally {
    await client.close();
  }
}

checkNewNodes().catch(console.error);

