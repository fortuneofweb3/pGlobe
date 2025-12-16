/**
 * Check if merge strategy and bug fix have been applied
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  process.exit(1);
}

async function checkDeploymentStatus() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`\n✅ Connected to MongoDB\n`);
    
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 'pGlobe';
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    // Get total counts
    const totalNodes = await collection.countDocuments({});
    const withPubkey = await collection.countDocuments({ 
      pubkey: { $exists: true, $ne: null, $ne: '' } 
    });
    const withPreviousAddresses = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    
    console.log(`📊 Current Database State:\n`);
    console.log(`   Total nodes: ${totalNodes}`);
    console.log(`   Nodes with pubkey: ${withPubkey}`);
    console.log(`   Nodes with IP history: ${withPreviousAddresses}`);
    
    // Check when nodes were last updated
    const mostRecent = await collection.findOne({}, { sort: { updatedAt: -1 } });
    if (mostRecent) {
      const lastUpdate = mostRecent.updatedAt ? new Date(mostRecent.updatedAt) : null;
      const now = new Date();
      const minutesAgo = lastUpdate ? Math.floor((now - lastUpdate) / 1000 / 60) : null;
      
      console.log(`\n⏰ Last Update:`);
      console.log(`   Time: ${lastUpdate ? lastUpdate.toISOString() : 'Unknown'}`);
      console.log(`   ${minutesAgo !== null ? minutesAgo + ' minutes ago' : ''}`);
      
      if (minutesAgo !== null && minutesAgo > 2) {
        console.log(`\n   ⚠️  Background refresh might not be running! (should run every 1 minute)`);
      } else {
        console.log(`\n   ✅ Background refresh is active`);
      }
    }
    
    // Check for merge strategy
    console.log(`\n🔍 Merge Strategy Status:\n`);
    
    if (withPreviousAddresses > 0) {
      console.log(`   ✅ DEPLOYED AND WORKING!`);
      console.log(`   ${withPreviousAddresses} nodes have IP change history\n`);
      
      // Show examples
      const examples = await collection.find({ 
        previousAddresses: { $exists: true, $ne: [] } 
      }).limit(5).toArray();
      
      console.log(`   Examples:`);
      examples.forEach((node, i) => {
        console.log(`   ${i + 1}. ${node.pubkey?.substring(0, 25)}...`);
        console.log(`      Current: ${node.address}`);
        console.log(`      Previous: [${node.previousAddresses.join(', ')}]`);
      });
    } else {
      console.log(`   ❌ NOT APPLIED YET`);
      console.log(`   Possible reasons:`);
      console.log(`   - Render hasn't deployed the new code yet`);
      console.log(`   - Background refresh hasn't run since deployment`);
      console.log(`   - No nodes have changed IPs yet (need to wait for IP changes)`);
    }
    
    // Check for nodes at same IP with different pubkeys (bug fix verification)
    console.log(`\n\n🔍 Bug Fix Status (Different Pubkeys at Same IP):\n`);
    
    const allNodes = await collection.find({
      pubkey: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    // Group by IP
    const ipMap = new Map();
    allNodes.forEach(node => {
      const ip = node.address?.split(':')[0];
      if (ip) {
        if (!ipMap.has(ip)) {
          ipMap.set(ip, []);
        }
        ipMap.get(ip).push(node);
      }
    });
    
    // Find IPs with multiple different pubkeys
    const sharedIPs = [];
    ipMap.forEach((nodes, ip) => {
      if (nodes.length > 1) {
        const uniquePubkeys = new Set(nodes.map(n => n.pubkey));
        if (uniquePubkeys.size > 1) {
          sharedIPs.push({ ip, count: uniquePubkeys.size, nodes });
        }
      }
    });
    
    if (sharedIPs.length > 0) {
      console.log(`   ✅ BUG FIX WORKING!`);
      console.log(`   Found ${sharedIPs.length} IPs with multiple different pubkeys:\n`);
      
      sharedIPs.slice(0, 5).forEach(({ ip, count, nodes }) => {
        console.log(`   IP: ${ip} → ${count} different nodes:`);
        nodes.forEach(node => {
          console.log(`      - ${node.pubkey?.substring(0, 30)}... (${node.version || 'no version'})`);
        });
        console.log('');
      });
      
      if (sharedIPs.length > 5) {
        console.log(`   ... and ${sharedIPs.length - 5} more shared IPs\n`);
      }
    } else {
      console.log(`   ⚠️  No IPs with multiple pubkeys found`);
      console.log(`   This could mean:`);
      console.log(`   - Bug fix not deployed yet`);
      console.log(`   - OR no nodes currently share IPs (less likely)`);
    }
    
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`\n📝 Summary:\n`);
    console.log(`   Merge strategy: ${withPreviousAddresses > 0 ? '✅ Working' : '❌ Not yet'}`);
    console.log(`   Bug fix (shared IPs): ${sharedIPs.length > 0 ? '✅ Working' : '⚠️  Not detected'}`);
    console.log(`   Total nodes: ${totalNodes} (expected to increase after bug fix)`);
    
  } finally {
    await client.close();
  }
}

checkDeploymentStatus().catch(console.error);

