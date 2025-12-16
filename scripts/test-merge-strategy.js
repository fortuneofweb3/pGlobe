/**
 * Test script to verify merge strategy implementation
 * Tests that nodes with same pubkey but different IPs are merged correctly
 */

const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(`\n❌ MONGODB_URI environment variable not set`);
  process.exit(1);
}

// Load duplicate pubkeys from previous analysis
const duplicatePubkeys = JSON.parse(fs.readFileSync('/tmp/duplicate_pubkeys.json', 'utf8'));

console.log(`\n🧪 Testing Merge Strategy Implementation\n`);
console.log(`Testing ${duplicatePubkeys.length} nodes with duplicate pubkeys:`);
duplicatePubkeys.forEach((dup, i) => {
  console.log(`${i + 1}. ${dup.pubkey.substring(0, 20)}... (${dup.count} IPs)`);
});

async function testMergeStrategy() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`\n✅ Connected to MongoDB`);
    
    const dbName = MONGODB_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/)?.[1] || 
                   process.env.MONGODB_DB_NAME || 
                   'pGlobe';
    
    const db = client.db(dbName);
    const collection = db.collection('nodes');
    
    console.log(`\n📊 Checking database for merged nodes...\n`);
    
    for (const dup of duplicatePubkeys) {
      const doc = await collection.findOne({ pubkey: dup.pubkey });
      
      if (!doc) {
        console.log(`❌ Pubkey ${dup.pubkey.substring(0, 20)}... not found in DB`);
        continue;
      }
      
      console.log(`\n✅ Found: ${dup.pubkey.substring(0, 20)}...`);
      console.log(`   Current address: ${doc.address}`);
      
      if (doc.previousAddresses && doc.previousAddresses.length > 0) {
        console.log(`   ✅ Previous addresses tracked: ${doc.previousAddresses.length}`);
        doc.previousAddresses.forEach((addr, i) => {
          console.log(`      ${i + 1}. ${addr}`);
        });
        
        // Check if all IPs are accounted for
        const allAddresses = [doc.address, ...doc.previousAddresses];
        const missingIPs = dup.addresses.filter(addr => !allAddresses.includes(addr));
        
        if (missingIPs.length === 0) {
          console.log(`   ✅ All ${dup.addresses.length} IP addresses tracked!`);
        } else {
          console.log(`   ⚠️  Missing IPs: ${missingIPs.length}`);
          missingIPs.forEach(ip => console.log(`      - ${ip}`));
        }
      } else {
        console.log(`   ❌ No previousAddresses field - merge not working yet`);
        console.log(`   Expected IPs:`);
        dup.addresses.forEach((addr, i) => {
          console.log(`      ${i + 1}. ${addr}`);
        });
      }
    }
    
    // Summary
    const docsWithPreviousAddresses = await collection.countDocuments({ 
      previousAddresses: { $exists: true, $ne: [] } 
    });
    
    console.log(`\n\n📈 Summary:`);
    console.log(`   Nodes with tracked IP changes: ${docsWithPreviousAddresses}`);
    console.log(`   Expected (nodes with duplicate pubkeys): ${duplicatePubkeys.length}`);
    
    if (docsWithPreviousAddresses >= duplicatePubkeys.length) {
      console.log(`   ✅ Merge strategy is working!`);
    } else if (docsWithPreviousAddresses > 0) {
      console.log(`   ⚠️  Merge strategy partially working - run background refresh to update all nodes`);
    } else {
      console.log(`   ❌ Merge strategy not yet applied - run background refresh to apply changes`);
    }
    
  } finally {
    await client.close();
  }
}

testMergeStrategy().catch(console.error);

