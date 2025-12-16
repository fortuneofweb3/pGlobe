/**
 * Quick comparison - check if we have duplicate pubkeys in current gossip
 */

const { MongoClient } = require('mongodb');

async function quickCheck() {
  console.log('\n🔍 Quick Check: Current Status\n');
  
  // Fetch from pRPC
  const response = await fetch('http://192.190.136.28:6000/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-pods-with-stats',
      id: 1
    })
  });
  
  const data = await response.json();
  const prpcNodes = data.result?.pods || [];
  
  console.log(`📡 pRPC: ${prpcNodes.length} total nodes\n`);
  
  // Check for duplicate pubkeys in pRPC
  const pubkeyMap = new Map();
  prpcNodes.forEach(node => {
    const pubkey = node.pubkey || node.publicKey || node.public_key;
    if (pubkey) {
      if (!pubkeyMap.has(pubkey)) {
        pubkeyMap.set(pubkey, []);
      }
      pubkeyMap.get(pubkey).push(node.address);
    }
  });
  
  const duplicates = [];
  pubkeyMap.forEach((addresses, pubkey) => {
    if (addresses.length > 1) {
      duplicates.push({ pubkey, addresses, count: addresses.length });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} pubkeys with multiple IPs in pRPC:\n`);
    duplicates.forEach(d => {
      console.log(`   ${d.pubkey.substring(0, 20)}... (${d.count} IPs):`);
      d.addresses.forEach(addr => console.log(`      - ${addr}`));
    });
  } else {
    console.log(`✅ No duplicate pubkeys in current pRPC response`);
    console.log(`   (All nodes have unique pubkeys with single IPs)\n`);
  }
  
  // Check database
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.log('\n⚠️  MONGODB_URI not set, skipping DB check');
    return;
  }
  
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  
  try {
    await client.connect();
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 'pGlobe';
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    const totalInDb = await collection.countDocuments({});
    const withHistory = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    
    console.log(`\n💾 Database: ${totalInDb} nodes`);
    console.log(`   Nodes with IP history: ${withHistory}`);
    
    if (withHistory > 0) {
      console.log(`\n✅ Merge strategy IS working!`);
    } else if (duplicates.length > 0) {
      console.log(`\n❌ Bug: ${duplicates.length} duplicate pubkeys in pRPC but merge not applied!`);
    } else {
      console.log(`\n✅ No duplicates in gossip right now, so merge strategy has nothing to do`);
    }
    
  } finally {
    await client.close();
  }
}

quickCheck().catch(console.error);

