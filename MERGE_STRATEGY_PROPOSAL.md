# Node Merge Strategy Proposal

## Current Problem
When a node has the same pubkey but different IP address, the current code picks one based on version/data count. This loses information and doesn't handle IP changes gracefully.

## Proposed Solution
**Merge nodes with same pubkey, track IP history, let gossip determine the active one**

## Strategy

### 1. Same Pubkey, Different IP = Same Node (IP Changed)
When we encounter a node with:
- Same pubkey
- Different IP address

**Action**: Merge them - they're the same node that changed IP addresses.

### 2. Merge Logic
- **Keep all data** from both entries (merge fields, prefer newer values)
- **Update address** to the one currently in gossip (the active one)
- **Track previous addresses** in a `previousAddresses` array
- **Use `seenInGossip`** to determine which is current

### 3. Gossip-Based Selection
- The node currently returned by `get-pods-with-stats` has `seenInGossip: true`
- Over time, whichever IP is still being returned by gossip becomes the active one
- Old IPs are tracked in history but the current address is always from gossip

## Implementation Changes Needed

### 1. Add to NodeDocument Schema
```typescript
export interface NodeDocument {
  // ... existing fields ...
  
  // IP address history (for tracking IP changes)
  previousAddresses?: string[]; // Array of previous IP:port addresses
  addressHistory?: Array<{
    address: string;
    firstSeen: Date;
    lastSeen: Date;
  }>;
}
```

### 2. Update Deduplication Logic
**Current** (line 508-534):
```typescript
// Same pubkey, different IP - keep the better node
if (newNodeVersion > existingVersion || ...) {
  // Replace with better node
}
```

**Proposed**:
```typescript
// Same pubkey, different IP - merge them (same node, IP changed)
if (pubkey && pubkeyToNode.has(pubkey)) {
  const existing = pubkeyToNode.get(pubkey)!;
  const existingIP = existing.address?.split(':')[0] || '';
  const newIP = node.address?.split(':')[0] || '';
  
  if (existingIP !== newIP) {
    // IP changed - merge nodes
    // 1. Update address to current one from gossip
    // 2. Add old address to previousAddresses if not already there
    // 3. Merge data (prefer newer values, but keep all)
    // 4. Mark as seenInGossip: true (current gossip response)
    
    const mergedNode = mergeNodes(existing, node);
    pubkeyToNode.set(pubkey, mergedNode);
    deduplicated.set(`pubkey:${pubkey}`, mergedNode);
    
    // Update IP mapping
    ipToNode.delete(existingIP);
    ipToNode.set(newIP, mergedNode);
  } else {
    // Same IP - just merge data (normal update)
    const mergedNode = mergeNodes(existing, node);
    pubkeyToNode.set(pubkey, mergedNode);
    deduplicated.set(`pubkey:${pubkey}`, mergedNode);
  }
  continue;
}
```

### 3. Merge Function
```typescript
function mergeNodes(existing: PNode, incoming: PNode): PNode {
  // Start with existing node
  const merged = { ...existing };
  
  // Update address to incoming (current from gossip)
  merged.address = incoming.address;
  
  // Track previous address if different
  if (existing.address !== incoming.address) {
    const previousAddresses = existing.previousAddresses || [];
    if (!previousAddresses.includes(existing.address)) {
      merged.previousAddresses = [...previousAddresses, existing.address];
    }
  }
  
  // Merge all fields - prefer incoming (newer) values, but keep existing if incoming is undefined
  for (const key in incoming) {
    if (incoming[key] !== undefined && incoming[key] !== null) {
      merged[key] = incoming[key];
    } else if (merged[key] === undefined) {
      // Keep existing value if incoming doesn't have it
      merged[key] = existing[key];
    }
  }
  
  // Always mark as seen in gossip (it's in current response)
  merged.seenInGossip = true;
  
  return merged;
}
```

### 4. MongoDB Update Logic
When updating a node with same pubkey but different IP:
```typescript
// Update the node document
await collection.updateOne(
  { _id: pubkey },
  {
    $set: {
      address: incoming.address, // Current address from gossip
      // ... other fields from incoming node
      seenInGossip: true,
      updatedAt: now,
    },
    $addToSet: {
      previousAddresses: existing.address // Add old address to history
    }
  }
);
```

## Benefits

1. **No data loss**: Both entries are merged, all information is preserved
2. **IP change tracking**: Can see when/where a node moved
3. **Gossip-driven**: The node currently in gossip automatically becomes the active one
4. **Historical context**: Previous IPs are tracked for analysis
5. **Automatic cleanup**: Over time, old IPs fade away naturally as they stop appearing in gossip

## Example Scenario

**Day 1**:
- Node: pubkey="ABC123", IP="192.168.1.1"
- Stored in MongoDB

**Day 2** (Node moves):
- Gossip returns: pubkey="ABC123", IP="10.0.0.1"
- **Action**: 
  - Update address to "10.0.0.1" (current from gossip)
  - Add "192.168.1.1" to previousAddresses
  - Merge all data
  - Mark seenInGossip: true

**Day 3** (Old IP still in DB but not in gossip):
- Old entry: pubkey="ABC123", IP="192.168.1.1", seenInGossip: false
- New entry: pubkey="ABC123", IP="10.0.0.1", seenInGossip: true
- **Action**: Merge them, keep "10.0.0.1" as active (it's in gossip)

**Result**: One node entry with current IP "10.0.0.1" and history showing it was at "192.168.1.1"

## Migration Strategy

1. Add `previousAddresses` field to schema (optional, so existing docs work)
2. Update deduplication logic to merge instead of replace
3. When processing nodes, check for existing nodes with same pubkey but different IP
4. Merge them and track address history
5. Clean up any orphaned entries (same pubkey, different IP, not in gossip)

