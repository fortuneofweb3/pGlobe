/**
 * Extract all valid pubkeys from pRPC response
 * Useful for manual comparison with database
 */

const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// Load pRPC response
const prpcResponse = JSON.parse(fs.readFileSync('/tmp/prpc_response.json', 'utf8'));
const prpcPods = prpcResponse.result?.pods || prpcResponse.result || [];

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

// Extract all valid pubkeys with their addresses
const validNodes = prpcPods
  .map((pod) => ({
    pubkey: pod.pubkey || pod.publicKey || '',
    address: pod.address || '',
    version: pod.version || 'unknown'
  }))
  .filter((node) => node.pubkey && isValidPubkey(node.pubkey));

console.log(`Found ${validNodes.length} nodes with valid pubkeys`);

// Save to files
const pubkeys = validNodes.map(n => n.pubkey).sort();
const nodesWithDetails = validNodes.map(n => ({
  pubkey: n.pubkey,
  address: n.address,
  version: n.version
}));

fs.writeFileSync('/tmp/prpc_valid_pubkeys.txt', pubkeys.join('\n'));
fs.writeFileSync('/tmp/prpc_valid_nodes.json', JSON.stringify(nodesWithDetails, null, 2));

console.log(`\n✅ Saved:`);
console.log(`   - /tmp/prpc_valid_pubkeys.txt (${pubkeys.length} pubkeys, one per line)`);
console.log(`   - /tmp/prpc_valid_nodes.json (${nodesWithDetails.length} nodes with details)`);
console.log(`\n💡 To compare with database:`);
console.log(`   1. Export DB pubkeys to a file`);
console.log(`   2. Run: comm -23 <(sort /tmp/prpc_valid_pubkeys.txt) <(sort db_pubkeys.txt)`);
console.log(`   3. This will show pubkeys in pRPC but not in DB`);

