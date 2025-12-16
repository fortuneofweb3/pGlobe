/**
 * Direct comparison script - connects to MongoDB directly
 * Compares pRPC nodes with MongoDB nodes
 */

const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Load pRPC response
const prpcResponse = JSON.parse(fs.readFileSync('/tmp/prpc_response.json', 'utf8'));
const prpcPods = prpcResponse.result?.pods || prpcResponse.result || [];

console.log(`\n📊 pRPC Response Analysis`);
console.log(`Total pods from pRPC: ${prpcPods.length}`);

// Validate pubkey function (same as in mongodb-nodes.ts)
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

// Extract valid pubkeys from pRPC
const prpcPubkeys = new Set();
const prpcByPubkey = new Map();

prpcPods.forEach((pod) => {
  const pubkey = pod.pubkey || pod.publicKey || '';
  if (pubkey && isValidPubkey(pubkey)) {
    prpcPubkeys.add(pubkey);
    prpcByPubkey.set(pubkey, pod);
  }
});

console.log(`✅ Valid pubkeys from pRPC: ${prpcPubkeys.size}`);

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  console.log(`\n💡 Set it like: MONGODB_URI="your-connection-string" node scripts/compare-nodes-direct.js`);
  process.exit(1);
}

async function fetchFromMongoDB() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to MongoDB`);
    
    // Get database name from URI or use default
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 
                   process.env.MONGODB_DB_NAME || 
                   'pGlobe';
    
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    const docs = await collection.find({}).toArray();
    console.log(`✅ Fetched ${docs.length} nodes from MongoDB`);
    
    return docs;
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    const dbDocs = await fetchFromMongoDB();
    
    // Extract pubkeys from DB
    const dbPubkeys = new Set();
    const dbByPubkey = new Map();
    
    dbDocs.forEach((doc) => {
      const pubkey = doc.pubkey || doc.publicKey || '';
      if (pubkey) {
        dbPubkeys.add(pubkey);
        dbByPubkey.set(pubkey, doc);
      }
    });
    
    console.log(`✅ Valid pubkeys in DB: ${dbPubkeys.size}`);
    
    // Find nodes in pRPC but not in DB
    const missingFromDB = [];
    prpcPubkeys.forEach((pubkey) => {
      if (!dbPubkeys.has(pubkey)) {
        const pod = prpcByPubkey.get(pubkey);
        missingFromDB.push({
          pubkey,
          address: pod.address || 'unknown',
          version: pod.version || 'unknown',
          reason: 'not_in_database'
        });
      }
    });
    
    // Find nodes in DB but not in pRPC (might be old/stale)
    const extraInDB = [];
    dbPubkeys.forEach((pubkey) => {
      if (!prpcPubkeys.has(pubkey)) {
        const doc = dbByPubkey.get(pubkey);
        extraInDB.push({
          pubkey,
          address: doc.address || 'unknown',
          version: doc.version || 'unknown',
          seenInGossip: doc.seenInGossip || false,
          updatedAt: doc.updatedAt || 'unknown'
        });
      }
    });
    
    // Check for duplicate pubkeys in pRPC (same pubkey, different IPs)
    const pubkeyToAddresses = new Map();
    prpcPods.forEach((pod) => {
      const pubkey = pod.pubkey || pod.publicKey || '';
      if (pubkey && isValidPubkey(pubkey)) {
        if (!pubkeyToAddresses.has(pubkey)) {
          pubkeyToAddresses.set(pubkey, []);
        }
        pubkeyToAddresses.get(pubkey).push(pod.address || 'unknown');
      }
    });
    
    const duplicatePubkeys = Array.from(pubkeyToAddresses.entries())
      .filter(([_, addresses]) => addresses.length > 1);
    
    console.log(`\n\n📊 Comparison Results:`);
    console.log(`   pRPC valid nodes: ${prpcPubkeys.size}`);
    console.log(`   DB nodes: ${dbPubkeys.size}`);
    console.log(`   Missing from DB: ${missingFromDB.length}`);
    console.log(`   Extra in DB (not in current gossip): ${extraInDB.length}`);
    console.log(`   Duplicate pubkeys in pRPC (same pubkey, different IPs): ${duplicatePubkeys.length}`);
    
    if (missingFromDB.length > 0) {
      console.log(`\n❌ Nodes in pRPC but NOT in Database (${missingFromDB.length}):`);
      missingFromDB.forEach((node, i) => {
        console.log(`\n   ${i + 1}. ${node.reason}`);
        console.log(`      Pubkey: ${node.pubkey}`);
        console.log(`      Address: ${node.address}`);
        console.log(`      Version: ${node.version}`);
      });
      
      fs.writeFileSync(
        '/tmp/missing_from_db.json',
        JSON.stringify(missingFromDB, null, 2)
      );
      console.log(`\n💾 Saved missing nodes to /tmp/missing_from_db.json`);
    }
    
    if (duplicatePubkeys.length > 0) {
      console.log(`\n⚠️  Duplicate Pubkeys in pRPC (Same pubkey, different IPs - ${duplicatePubkeys.length}):`);
      duplicatePubkeys.slice(0, 10).forEach(([pubkey, addresses], i) => {
        console.log(`\n   ${i + 1}. Pubkey: ${pubkey.substring(0, 20)}...`);
        console.log(`      Addresses: ${addresses.join(', ')}`);
        console.log(`      ⚠️  This could cause deduplication - only one will be kept!`);
      });
      if (duplicatePubkeys.length > 10) {
        console.log(`   ... and ${duplicatePubkeys.length - 10} more`);
      }
      
      fs.writeFileSync(
        '/tmp/duplicate_pubkeys.json',
        JSON.stringify(duplicatePubkeys.map(([pubkey, addresses]) => ({
          pubkey,
          addresses,
          count: addresses.length
        })), null, 2)
      );
      console.log(`\n💾 Saved duplicate pubkeys to /tmp/duplicate_pubkeys.json`);
    }
    
    if (extraInDB.length > 0) {
      const notSeenInGossip = extraInDB.filter(n => !n.seenInGossip).length;
      console.log(`\n📦 Nodes in DB but NOT in current pRPC (${extraInDB.length}):`);
      console.log(`   - Not seen in gossip: ${notSeenInGossip} (likely offline/stale)`);
      console.log(`   - Seen in gossip: ${extraInDB.length - notSeenInGossip}`);
    }
    
    // Final summary
    console.log(`\n\n🎯 Final Analysis:`);
    console.log(`   Total from pRPC: ${prpcPods.length}`);
    console.log(`   Valid pubkeys: ${prpcPubkeys.size}`);
    console.log(`   Actually in DB: ${dbPubkeys.size}`);
    console.log(`   Missing from DB: ${missingFromDB.length}`);
    console.log(`   Difference: ${prpcPubkeys.size - dbPubkeys.size} nodes`);
    
    if (missingFromDB.length > 0) {
      console.log(`\n⚠️  These ${missingFromDB.length} nodes should be in DB but aren't:`);
      console.log(`   Possible reasons:`);
      console.log(`   1. Deduplication removed them (same pubkey, different IP)`);
      console.log(`   2. MongoDB write failed during upsert`);
      console.log(`   3. They were filtered during processing`);
      console.log(`   4. Timing issue (appeared in pRPC but not processed yet)`);
    }
    
    if (duplicatePubkeys.length > 0) {
      console.log(`\n⚠️  Found ${duplicatePubkeys.length} nodes with duplicate pubkeys (same pubkey, different IPs)`);
      console.log(`   These are likely the same node that changed IP addresses.`);
      console.log(`   Current logic keeps only one - consider implementing merge strategy!`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('authentication')) {
      console.log(`\n💡 Check your MONGODB_URI connection string`);
    } else if (error.message.includes('timeout')) {
      console.log(`\n💡 MongoDB connection timeout - check network/firewall`);
    }
    process.exit(1);
  }
}

main();

