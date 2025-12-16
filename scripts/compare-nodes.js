/**
 * Script to compare pRPC nodes with MongoDB nodes
 * Identifies which nodes are being filtered and why
 */

const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Load pRPC response
const prpcResponse = JSON.parse(fs.readFileSync('/tmp/prpc_response.json', 'utf8'));
const prpcPods = prpcResponse.result?.pods || prpcResponse.result || [];

console.log(`\n📊 pRPC Response Analysis`);
console.log(`Total pods from pRPC: ${prpcPods.length}`);

// Function to fetch nodes from database via API
async function fetchNodesFromDB() {
  return new Promise((resolve, reject) => {
    // Try to get from environment or use default
    const apiUrl = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL || 'http://localhost:3001';
    const apiSecret = process.env.API_SECRET || '';
    
    const url = new URL(`${apiUrl}/api/pnodes`);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret ? { 'Authorization': `Bearer ${apiSecret}` } : {})
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.nodes || []);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Validate pubkey function (same as in mongodb-nodes.ts)
function isValidPubkey(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') return false;
  
  const trimmed = pubkey.trim();
  if (!trimmed) return false;
  
  // Invalid patterns
  if (trimmed.length < 32) return false;
  if (trimmed.length > 44) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) return false;
  if (/^pubkey\d+$/i.test(trimmed)) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  
  // Try to validate as base58 Solana pubkey
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

// Analyze pRPC pods
const analysis = {
  total: prpcPods.length,
  withPubkey: 0,
  withoutPubkey: 0,
  validPubkeys: 0,
  invalidPubkeys: 0,
  invalidReasons: {},
  invalidNodes: []
};

prpcPods.forEach((pod, index) => {
  const pubkey = pod.pubkey || pod.publicKey || '';
  const address = pod.address || '';
  
  if (pubkey) {
    analysis.withPubkey++;
    
    if (isValidPubkey(pubkey)) {
      analysis.validPubkeys++;
    } else {
      analysis.invalidPubkeys++;
      
      // Determine reason
      let reason = 'unknown';
      const trimmed = pubkey.trim();
      
      if (!trimmed) {
        reason = 'empty_after_trim';
      } else if (trimmed.length < 32) {
        reason = `too_short_${trimmed.length}_chars`;
      } else if (trimmed.length > 44) {
        reason = `too_long_${trimmed.length}_chars`;
      } else if (/\s/.test(trimmed)) {
        reason = 'contains_whitespace';
      } else if (/^\d+\.\d+\.\d+\.\d+/.test(trimmed)) {
        reason = 'is_ip_address';
      } else if (/^pubkey\d+$/i.test(trimmed)) {
        reason = 'invalid_pattern_pubkeyN';
      } else if (/^[0-9]+$/.test(trimmed)) {
        reason = 'only_numbers';
      } else {
        reason = 'fails_solana_validation';
      }
      
      if (!analysis.invalidReasons[reason]) {
        analysis.invalidReasons[reason] = 0;
      }
      analysis.invalidReasons[reason]++;
      
      analysis.invalidNodes.push({
        index,
        pubkey,
        address,
        reason,
        version: pod.version || 'unknown'
      });
    }
  } else {
    analysis.withoutPubkey++;
    analysis.invalidNodes.push({
      index,
      pubkey: null,
      address,
      reason: 'missing_pubkey',
      version: pod.version || 'unknown'
    });
  }
});

console.log(`\n✅ Valid pubkeys: ${analysis.validPubkeys}`);
console.log(`❌ Invalid/missing pubkeys: ${analysis.invalidPubkeys + analysis.withoutPubkey}`);
console.log(`   - Missing pubkey: ${analysis.withoutPubkey}`);
console.log(`   - Invalid pubkey: ${analysis.invalidPubkeys}`);

if (Object.keys(analysis.invalidReasons).length > 0) {
  console.log(`\n📋 Invalid Pubkey Reasons:`);
  Object.entries(analysis.invalidReasons).forEach(([reason, count]) => {
    console.log(`   - ${reason}: ${count}`);
  });
}

if (analysis.invalidNodes.length > 0) {
  console.log(`\n🔍 Filtered Nodes (${analysis.invalidNodes.length}):`);
  analysis.invalidNodes.forEach((node, i) => {
    console.log(`\n   ${i + 1}. ${node.reason}`);
    console.log(`      Address: ${node.address}`);
    console.log(`      Pubkey: ${node.pubkey || '(missing)'}`);
    console.log(`      Version: ${node.version}`);
  });
  
  // Save to file
  fs.writeFileSync(
    '/tmp/filtered_nodes.json',
    JSON.stringify(analysis.invalidNodes, null, 2)
  );
  console.log(`\n💾 Saved filtered nodes to /tmp/filtered_nodes.json`);
}

console.log(`\n📈 Summary:`);
console.log(`   Total from pRPC: ${analysis.total}`);
console.log(`   Valid (would be stored): ${analysis.validPubkeys}`);
console.log(`   Filtered out: ${analysis.invalidPubkeys + analysis.withoutPubkey}`);
console.log(`   Expected in DB: ${analysis.validPubkeys}`);

// Now compare with database
console.log(`\n\n🔍 Comparing with Database...`);
console.log(`Attempting to fetch nodes from database...`);

fetchNodesFromDB()
  .then((dbNodes) => {
    console.log(`✅ Fetched ${dbNodes.length} nodes from database`);
    
    // Create maps for comparison
    const prpcPubkeys = new Set();
    const prpcByPubkey = new Map();
    
    prpcPods.forEach((pod) => {
      const pubkey = pod.pubkey || pod.publicKey || '';
      if (pubkey && isValidPubkey(pubkey)) {
        prpcPubkeys.add(pubkey);
        prpcByPubkey.set(pubkey, pod);
      }
    });
    
    const dbPubkeys = new Set();
    const dbByPubkey = new Map();
    
    dbNodes.forEach((node) => {
      const pubkey = node.pubkey || node.publicKey || '';
      if (pubkey) {
        dbPubkeys.add(pubkey);
        dbByPubkey.set(pubkey, node);
      }
    });
    
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
        const node = dbByPubkey.get(pubkey);
        extraInDB.push({
          pubkey,
          address: node.address || 'unknown',
          version: node.version || 'unknown',
          seenInGossip: node.seenInGossip || false,
          reason: 'not_in_current_gossip'
        });
      }
    });
    
    console.log(`\n📊 Comparison Results:`);
    console.log(`   pRPC valid nodes: ${prpcPubkeys.size}`);
    console.log(`   DB nodes: ${dbPubkeys.size}`);
    console.log(`   Missing from DB: ${missingFromDB.length}`);
    console.log(`   Extra in DB (not in current gossip): ${extraInDB.length}`);
    
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
    
    if (extraInDB.length > 0) {
      console.log(`\n📦 Nodes in DB but NOT in current pRPC (${extraInDB.length}):`);
      const seenInGossip = extraInDB.filter(n => n.seenInGossip).length;
      const notSeenInGossip = extraInDB.filter(n => !n.seenInGossip).length;
      console.log(`   - Seen in gossip: ${seenInGossip}`);
      console.log(`   - Not seen in gossip: ${notSeenInGossip}`);
      
      if (notSeenInGossip > 0) {
        console.log(`\n   These are likely offline/stale nodes:`);
        extraInDB.filter(n => !n.seenInGossip).slice(0, 10).forEach((node, i) => {
          console.log(`   ${i + 1}. ${node.pubkey} (${node.address}) - ${node.version}`);
        });
      }
    }
    
    // Final summary
    console.log(`\n\n🎯 Final Analysis:`);
    console.log(`   Total from pRPC: ${prpcPods.length}`);
    console.log(`   Valid pubkeys: ${analysis.validPubkeys}`);
    console.log(`   Filtered (invalid pubkey): ${analysis.invalidPubkeys + analysis.withoutPubkey}`);
    console.log(`   Expected in DB: ${analysis.validPubkeys}`);
    console.log(`   Actually in DB: ${dbNodes.length}`);
    console.log(`   Missing from DB: ${missingFromDB.length}`);
    console.log(`   Difference: ${analysis.validPubkeys - dbNodes.length} nodes`);
    
    if (missingFromDB.length > 0) {
      console.log(`\n⚠️  These ${missingFromDB.length} nodes should be in DB but aren't:`);
      console.log(`   Possible reasons:`);
      console.log(`   - Deduplication removed them`);
      console.log(`   - MongoDB write failed`);
      console.log(`   - They were filtered during upsert`);
    }
  })
  .catch((error) => {
    console.error(`\n❌ Failed to fetch from database: ${error.message}`);
    console.log(`\n💡 To compare with database, you can:`);
    console.log(`   1. Set RENDER_API_URL environment variable`);
    console.log(`   2. Or manually fetch from /api/pnodes endpoint`);
    console.log(`   3. Or export DB nodes to JSON and compare manually`);
  });

