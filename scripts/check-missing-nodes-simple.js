/**
 * Check if the 3 missing nodes are now in the database
 */

const { MongoClient } = require('mongodb');
const { PublicKey } = require('@solana/web3.js');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  console.log(`Run: MONGODB_URI="your-uri" node scripts/check-missing-nodes-simple.js\n`);
  process.exit(1);
}

// The 3 nodes that were missing from the database
const MISSING_NODES = [
  {
    pubkey: 'E4n5aPdtWmBvU2x8oLxx5UMTPQoRDK5t9e8XCoekarLe',
    address: '154.38.171.140:9001',
    version: '0.8.0-trynet.20251212183600.9eea72e'
  },
  {
    pubkey: 'DoyF9Ex83JtRThuwrpwJaacSu8yZWQ2UUohRM6swrtzD',
    address: '154.38.170.117:9001',
    version: '0.8.0-trynet.20251212183600.9eea72e'
  },
  {
    pubkey: '8rTJCEe6bPcfbi8JgYbHNzSZFy1ADubieYS2wQdRfCXX',
    address: '154.38.175.38:9001',
    version: '0.8.0-trynet.20251212183600.9eea72e'
  }
];

// Validate pubkey using same logic as backend
function isValidPubkey(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') return false;
  
  const trimmed = pubkey.trim();
  if (!trimmed) return false;
  
  if (trimmed.length < 32) return false;
  if (trimmed.length > 44) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false;
  if (/^pubkey\d+$/i.test(trimmed)) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

async function checkMissingNodes() {
  console.log(`\n🔍 Checking Missing Nodes in Database\n`);
  console.log(`Checking ${MISSING_NODES.length} nodes that were previously missing...\n`);
  
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to MongoDB\n`);
    
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 
                   process.env.MONGODB_DB_NAME || 
                   'pGlobe';
    
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    let foundCount = 0;
    let stillMissingCount = 0;
    
    // Check each missing node
    for (const node of MISSING_NODES) {
      console.log(`${'='.repeat(80)}`);
      console.log(`\n🔍 Node: ${node.pubkey.substring(0, 20)}...`);
      console.log(`   Full pubkey: ${node.pubkey}`);
      console.log(`   Expected address: ${node.address}`);
      
      // Validate the pubkey
      const isValid = isValidPubkey(node.pubkey);
      console.log(`   Pubkey validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // Check if it's in the database by pubkey
      const byPubkey = await collection.findOne({ pubkey: node.pubkey });
      
      if (byPubkey) {
        foundCount++;
        console.log(`\n   ✅ FOUND IN DATABASE!`);
        console.log(`   Current address: ${byPubkey.address}`);
        console.log(`   Version: ${byPubkey.version || 'N/A'}`);
        console.log(`   Status: ${byPubkey.status || 'N/A'}`);
        console.log(`   Last seen: ${byPubkey.lastSeen ? new Date(byPubkey.lastSeen).toISOString() : 'N/A'}`);
        console.log(`   Seen in gossip: ${byPubkey.seenInGossip !== undefined ? byPubkey.seenInGossip : 'N/A'}`);
        
        if (byPubkey.previousAddresses && byPubkey.previousAddresses.length > 0) {
          console.log(`   Previous addresses tracked: ${byPubkey.previousAddresses.length}`);
          byPubkey.previousAddresses.forEach((addr, i) => {
            console.log(`      ${i + 1}. ${addr}`);
          });
        } else {
          console.log(`   Previous addresses: None (node hasn't changed IPs)`);
        }
      } else {
        stillMissingCount++;
        console.log(`\n   ❌ NOT IN DATABASE`);
        
        // Check by address as fallback
        const byAddress = await collection.findOne({ address: node.address });
        if (byAddress) {
          console.log(`   ⚠️  Address ${node.address} exists with different pubkey:`);
          console.log(`      DB pubkey: ${byAddress.pubkey}`);
        } else {
          console.log(`   Address ${node.address} also not found in DB`);
        }
        
        // Check if IP is in previousAddresses of any node
        const withPrevAddr = await collection.findOne({ 
          previousAddresses: node.address 
        });
        if (withPrevAddr) {
          console.log(`   ℹ️  Address found in previousAddresses of node:`);
          console.log(`      Pubkey: ${withPrevAddr.pubkey}`);
          console.log(`      Current address: ${withPrevAddr.address}`);
        }
      }
      
      console.log('');
    }
    
    // Summary
    console.log(`${'='.repeat(80)}`);
    console.log(`\n📊 SUMMARY\n`);
    
    console.log(`   Previously missing: ${MISSING_NODES.length} nodes`);
    console.log(`   Now in database: ${foundCount} nodes ${foundCount > 0 ? '✅' : ''}`);
    console.log(`   Still missing: ${stillMissingCount} nodes ${stillMissingCount > 0 ? '⚠️' : ''}`);
    
    const totalNodes = await collection.countDocuments({});
    console.log(`\n   Total nodes in database: ${totalNodes}`);
    
    // Check nodes with valid pubkeys
    const withValidPubkey = await collection.countDocuments({ 
      pubkey: { $exists: true, $ne: null, $ne: '' } 
    });
    console.log(`   Nodes with pubkey: ${withValidPubkey}`);
    
    // Check for nodes with previousAddresses (merge strategy working)
    const withHistory = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    console.log(`   Nodes with IP history: ${withHistory}`);
    
    if (withHistory > 0) {
      console.log(`\n   ✅ Merge strategy is working! (${withHistory} nodes have IP change history)`);
      
      // Show examples
      const examples = await collection.find({ 
        previousAddresses: { $exists: true, $ne: [] } 
      }).limit(3).toArray();
      
      console.log(`\n   Example nodes with IP history:`);
      examples.forEach((node, i) => {
        console.log(`   ${i + 1}. ${node.pubkey?.substring(0, 20)}... (${node.previousAddresses.length} previous IPs)`);
      });
    } else {
      console.log(`\n   ⚠️  No nodes with IP history yet - merge strategy may not have run yet`);
    }
    
    if (foundCount === MISSING_NODES.length) {
      console.log(`\n✅ ALL PREVIOUSLY MISSING NODES ARE NOW IN THE DATABASE!`);
    } else if (foundCount > 0) {
      console.log(`\n⚠️  Some nodes are now in the database, but ${stillMissingCount} still missing`);
    } else {
      console.log(`\n❌ None of the missing nodes have been added yet`);
      console.log(`   Possible reasons:`);
      console.log(`   - Background refresh hasn't run yet`);
      console.log(`   - Nodes went offline`);
      console.log(`   - There's a filtering/validation issue`);
    }
    
  } finally {
    await client.close();
  }
}

checkMissingNodes().catch(console.error);

