/**
 * Check if the 3 missing nodes are now in the database
 * and investigate why they might be missing
 */

const { MongoClient } = require('mongodb');
const { PublicKey } = require('@solana/web3.js');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  console.log(`Run: MONGODB_URI="your-uri" node scripts/check-missing-nodes.js\n`);
  process.exit(1);
}

const PRPC_URL = 'http://192.190.136.28:6000/rpc';

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

async function fetchCurrentPRPC() {
  const response = await fetch(PRPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-pods-with-stats',
      id: 1
    })
  });
  
  const data = await response.json();
  return data.result?.pods || [];
}

async function checkMissingNodes() {
  console.log(`\n🔍 Checking Missing Nodes\n`);
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
    
    // Get current pRPC data
    console.log(`📡 Fetching current pRPC data...\n`);
    const prpcNodes = await fetchCurrentPRPC();
    console.log(`   Total pRPC nodes: ${prpcNodes.length}\n`);
    
    // Check each missing node
    for (const node of MISSING_NODES) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`\n🔍 Checking: ${node.pubkey}`);
      console.log(`   Expected address: ${node.address}`);
      console.log(`   Expected version: ${node.version}`);
      
      // 1. Validate the pubkey
      const isValid = isValidPubkey(node.pubkey);
      console.log(`\n   ✓ Pubkey validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // 2. Check if it's in current pRPC response
      const inPRPC = prpcNodes.find(n => {
        const pk = n.pubkey || n.publicKey || n.public_key || '';
        return pk === node.pubkey;
      });
      
      if (inPRPC) {
        console.log(`   ✓ In current pRPC: ✅ YES`);
        console.log(`      Address: ${inPRPC.address}`);
        console.log(`      Version: ${inPRPC.version}`);
      } else {
        console.log(`   ✓ In current pRPC: ❌ NO (node might be offline now)`);
      }
      
      // 3. Check if it's in the database by pubkey
      const byPubkey = await collection.findOne({ pubkey: node.pubkey });
      if (byPubkey) {
        console.log(`   ✓ In DB (by pubkey): ✅ YES`);
        console.log(`      Address: ${byPubkey.address}`);
        console.log(`      Version: ${byPubkey.version || 'N/A'}`);
        console.log(`      Last seen: ${byPubkey.lastSeen ? new Date(byPubkey.lastSeen).toISOString() : 'N/A'}`);
        console.log(`      Seen in gossip: ${byPubkey.seenInGossip}`);
        if (byPubkey.previousAddresses && byPubkey.previousAddresses.length > 0) {
          console.log(`      Previous addresses: ${byPubkey.previousAddresses.length}`);
        }
      } else {
        console.log(`   ✓ In DB (by pubkey): ❌ NO`);
        
        // Check by address as fallback
        const byAddress = await collection.findOne({ address: node.address });
        if (byAddress) {
          console.log(`   ✓ In DB (by address): ⚠️  YES but with different pubkey`);
          console.log(`      DB pubkey: ${byAddress.pubkey}`);
        } else {
          console.log(`   ✓ In DB (by address): ❌ NO`);
        }
      }
      
      // 4. If in pRPC but not in DB, investigate why
      if (inPRPC && !byPubkey) {
        console.log(`\n   ⚠️  NODE IS IN pRPC BUT NOT IN DATABASE`);
        console.log(`   Possible reasons:`);
        console.log(`   - Background refresh hasn't run yet after deployment`);
        console.log(`   - Filtering logic is removing it`);
        console.log(`   - Database write is failing`);
        console.log(`   - Node was added very recently`);
      }
      
      // 5. If not in pRPC and not in DB
      if (!inPRPC && !byPubkey) {
        console.log(`\n   ℹ️  NODE IS OFFLINE (not in pRPC or DB)`);
        console.log(`   Likely the node went offline between checks`);
      }
      
      // 6. If in DB now but wasn't before
      if (byPubkey) {
        console.log(`\n   ✅ GOOD NEWS: Node is now in database!`);
        console.log(`   Background refresh successfully added this node.`);
      }
    }
    
    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`\n📊 SUMMARY\n`);
    
    const totalInDB = await collection.countDocuments({ 
      pubkey: { $in: MISSING_NODES.map(n => n.pubkey) } 
    });
    
    console.log(`   Previously missing: ${MISSING_NODES.length} nodes`);
    console.log(`   Now in database: ${totalInDB} nodes`);
    console.log(`   Still missing: ${MISSING_NODES.length - totalInDB} nodes`);
    
    const totalNodes = await collection.countDocuments({});
    console.log(`\n   Total nodes in database: ${totalNodes}`);
    
    // Check for nodes with previousAddresses
    const withHistory = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    console.log(`   Nodes with IP history: ${withHistory}`);
    
    if (withHistory > 0) {
      console.log(`   ✅ Merge strategy is working!`);
    }
    
  } finally {
    await client.close();
  }
}

checkMissingNodes().catch(console.error);

