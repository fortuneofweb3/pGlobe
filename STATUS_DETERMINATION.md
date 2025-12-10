# Node Status Determination Logic

## Current Implementation

Status is determined by **three overlapping mechanisms**:

### 1. **Gossip `last_seen_timestamp` (Primary)**
Location: `lib/server/prpc.ts::calculateStatus()`

```typescript
function calculateStatus(lastSeenTimestamp: number | undefined) {
  if (!lastSeenTimestamp) {
    return { status: 'syncing', lastSeen: Date.now() };
  }

  const timeSinceLastSeen = Date.now() - lastSeen;
  
  if (timeSinceLastSeen < 5 minutes) {
    status = 'online';
  } else if (timeSinceLastSeen < 1 hour) {
    status = 'syncing';
  } else {
    status = 'offline';
  }
}
```

**Problem**: This uses gossip data's `last_seen_timestamp`, which might be stale or inaccurate.

---

### 2. **Direct pRPC `get-stats` Response (Override)**
Location: `lib/server/prpc.ts::fetchNodeStats()`

```typescript
// If get-stats succeeds → node is definitely online
if (statsResult.status === 'fulfilled' && statsResult.value) {
  enrichedNode.status = 'online';  // Override with actual response
} else {
  // If stats call failed AND no latency → mark as offline
  if (latency === null) {
    enrichedNode.status = 'offline';
  }
}
```

**Problem**: Most nodes don't respond to `get-stats` (pRPC is localhost-only by default), so this only works for public nodes.

---

### 3. **Gossip Presence (`seenInGossip` flag)**
Location: `lib/server/mongodb-nodes.ts::upsertNodes()`

```typescript
// Mark nodes that appear in current gossip cycle
node.seenInGossip = true;

// Mark nodes NOT in gossip as offline
await collection.updateMany(
  { _id: { $nin: Array.from(seenNodeIds) } },
  { $set: { seenInGossip: false } }
);
```

**Problem**: This flag exists but **isn't actually used to determine status**! It's just stored in DB but not applied to the `status` field.

---

## The Real Issue

**The status determination is mostly based on `last_seen_timestamp` from gossip**, which is:
- ✅ Quick (no need to ping every node)
- ❌ Potentially inaccurate (gossip data might be stale)
- ❌ Doesn't account for nodes that disappear from gossip

## Better Approach

You should use **`seenInGossip` flag** as the primary indicator:

1. **If node appears in gossip** → `seenInGossip: true` → `status: 'online'`
2. **If node doesn't appear in gossip** → `seenInGossip: false` → `status: 'offline'`
3. **Use `last_seen_timestamp` as fallback** only if `seenInGossip` is undefined

This would be more accurate because:
- Gossip is the source of truth - if a node isn't in gossip, it's likely offline
- `last_seen_timestamp` can be stale (node might have gone offline but gossip hasn't updated yet)

## Current Flow

```
1. Fetch gossip → get nodes with last_seen_timestamp
2. calculateStatus(last_seen_timestamp) → determines status
3. Store in MongoDB with status field
4. Also store seenInGossip flag (but don't use it for status!)
5. Mark nodes NOT in gossip as seenInGossip: false (but status stays whatever it was)
```

**This is why status might not update correctly when nodes go offline!**

