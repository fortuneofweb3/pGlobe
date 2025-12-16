const { MongoClient } = require('mongodb');
const https = require('https');

async function checkStatus() {
  console.log('='.repeat(70));
  console.log('CHECKING FIX STATUS');
  console.log('='.repeat(70));

  try {
    // 1. Get pRPC data
    console.log('\n📡 Fetching from pRPC...');
    const pRPCData = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ 
        jsonrpc: "2.0", 
        method: "get-pods-with-stats", 
        id: 1 
      });
      
      const req = https.request({
        hostname: '192.190.136.28',
        port: 6000,
        path: '/rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const pRPCNodes = pRPCData.result?.pods || [];
    const validPubkeys = pRPCNodes.filter(n => {
      const pubkey = n.pubkey || '';
      return pubkey && pubkey.length >= 32 && pubkey.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(pubkey);
    });
    
    const uniquePubkeys = new Set(validPubkeys.map(n => n.pubkey));
    const uniqueIPs = new Set(validPubkeys.map(n => n.address?.split(':')[0]).filter(Boolean));
    
    console.log(`✅ pRPC: ${pRPCNodes.length} total nodes`);
    console.log(`✅ pRPC: ${validPubkeys.length} nodes with valid pubkeys`);
    console.log(`✅ pRPC: ${uniquePubkeys.size} unique pubkeys`);
    console.log(`✅ pRPC: ${uniqueIPs.size} unique IPs`);
    console.log(`📊 pRPC: ${validPubkeys.length - uniquePubkeys.size} duplicate pubkeys (same pubkey, different IPs)`);

    // 2. Get MongoDB data
    console.log('\n📊 Fetching from MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not set');
      return;
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db('pGlobe');
    const collection = db.collection('pnodes');
    
    const allNodes = await collection.find({}).toArray();
    const nodesWithPreviousAddresses = allNodes.filter(n => n.previousAddresses && n.previousAddresses.length > 0);
    const onlineNodes = allNodes.filter(n => {
      const lastSeen = n.lastSeen || 0;
      const ageMinutes = (Date.now() - lastSeen) / 1000 / 60;
      return ageMinutes < 5; // Seen in last 5 minutes
    });
    
    console.log(`✅ MongoDB: ${allNodes.length} total nodes`);
    console.log(`✅ MongoDB: ${onlineNodes.length} online nodes (seen < 5 min ago)`);
    console.log(`✅ MongoDB: ${nodesWithPreviousAddresses.length} nodes with previousAddresses`);
    
    if (nodesWithPreviousAddresses.length > 0) {
      console.log('\n📍 Sample nodes with IP history:');
      nodesWithPreviousAddresses.slice(0, 3).forEach(n => {
        console.log(`  - ${n.pubkey?.substring(0, 8)}... : ${n.address} (was: ${n.previousAddresses.join(', ')})`);
      });
    }

    // 3. Check last update
    const mostRecent = allNodes
      .filter(n => n.updatedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    
    if (mostRecent) {
      const updateAge = Math.floor((Date.now() - new Date(mostRecent.updatedAt)) / 1000 / 60);
      console.log(`\n⏰ Last update: ${updateAge} minutes ago`);
      if (updateAge < 2) {
        console.log('✅ Background refresh is RUNNING (updated < 2 min ago)');
      } else {
        console.log('⚠️  Background refresh may be stuck (no updates in 2+ min)');
      }
    }

    // 4. Analysis
    console.log('\n' + '='.repeat(70));
    console.log('ANALYSIS');
    console.log('='.repeat(70));
    
    const diff = validPubkeys.length - onlineNodes.length;
    console.log(`📊 pRPC valid nodes: ${validPubkeys.length}`);
    console.log(`📊 MongoDB online: ${onlineNodes.length}`);
    console.log(`📊 Difference: ${diff} nodes`);
    
    if (diff > 10) {
      console.log('⚠️  ISSUE: Still missing many nodes from pRPC');
      console.log('   → Check if new code is deployed and running');
    } else if (diff > 0) {
      console.log('ℹ️  Small difference may be due to:');
      console.log('   - Nodes going offline between pRPC fetch and DB update');
      console.log('   - Deduplication of same pubkey at different IPs');
    } else {
      console.log('✅ Node counts match expected range!');
    }
    
    if (nodesWithPreviousAddresses.length > 0) {
      console.log(`✅ MERGE STRATEGY WORKING: ${nodesWithPreviousAddresses.length} nodes tracking IP history`);
    } else {
      console.log('⚠️  MERGE STRATEGY NOT DEPLOYED: No nodes with previousAddresses');
    }

    await client.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStatus();
