# Node Deduplication Criteria

## Overview
When duplicate nodes are found, the system uses a priority-based selection criteria to determine which node to keep.

## Deduplication Scenarios

### Scenario 1: Duplicate Pubkey (Same pubkey, possibly different IPs)
**Location**: `lib/server/mongodb-nodes.ts:509-534`

**Selection Criteria** (in order):
1. **Later version** - Node with higher version string wins
2. **More data fields** - If versions are equal, node with more non-null/undefined fields wins
3. **First-come-first-served** - If versions and data counts are equal, existing node is kept

**Logic**:
```typescript
if (newNodeVersion > existingVersion || 
    (newNodeVersion === existingVersion && newNodeDataCount > existingDataCount)) {
  // Replace with better node
} else {
  // Keep existing node (skip new one)
}
```

**Examples**:

**Example 1.1**: Different versions
- Node A: pubkey="ABC123", IP="192.168.1.1", version="0.7.0", has 15 data fields
- Node B: pubkey="ABC123", IP="10.0.0.1", version="0.8.0", has 12 data fields
- **Result**: Node B wins (higher version), IP mapping updated to 10.0.0.1

**Example 1.2**: Same version, different data counts
- Node A: pubkey="ABC123", IP="192.168.1.1", version="0.7.0", has 15 data fields
- Node B: pubkey="ABC123", IP="10.0.0.1", version="0.7.0", has 20 data fields
- **Result**: Node B wins (more data), IP mapping updated to 10.0.0.1

**Example 1.3**: Same version, same data count
- Node A: pubkey="ABC123", IP="192.168.1.1", version="0.7.0", has 15 data fields
- Node B: pubkey="ABC123", IP="10.0.0.1", version="0.7.0", has 15 data fields
- **Result**: Node A wins (first-come-first-served), Node B is skipped

---

### Scenario 2: Duplicate IP Address (Same IP, possibly different pubkeys)
**Location**: `lib/server/mongodb-nodes.ts:537-582`

**Selection Criteria** (in priority order):

#### Priority 1: Node with pubkey > Node without pubkey
- If one node has a pubkey and the other doesn't, **always keep the one with pubkey**

**Example**:
- Node A: IP="192.168.1.1", pubkey="ABC123", version="0.7.0"
- Node B: IP="192.168.1.1", pubkey=null, version="0.8.0"
- **Result**: Node A wins (has pubkey)

#### Priority 2: Later version (if both have pubkeys or both don't)
- If both have pubkeys (but different) OR both don't have pubkeys
- Keep the node with **higher version string**

**Example**:
- Node A: IP="192.168.1.1", pubkey="ABC123", version="0.7.0"
- Node B: IP="192.168.1.1", pubkey="XYZ789", version="0.8.0"
- **Result**: Node B wins (higher version)

#### Priority 3: More data fields (if versions are equal)
- If versions are equal, keep the node with **more non-null/undefined fields**

**Example**:
- Node A: IP="192.168.1.1", version="0.7.0", has 15 data fields
- Node B: IP="192.168.1.1", version="0.7.0", has 20 data fields
- **Result**: Node B wins (more data)

---

## Complete Decision Tree

```
Duplicate Found?
├─ Same Pubkey?
│  ├─ Compare versions
│  │  ├─ New version > Existing? → Keep NEW
│  │  └─ Versions equal? → Compare data count
│  │     ├─ New has more data? → Keep NEW
│  │     └─ Otherwise → Keep EXISTING
│  │
└─ Same IP?
   ├─ New has pubkey, existing doesn't? → Keep NEW
   ├─ Existing has pubkey, new doesn't? → Keep EXISTING
   ├─ Both have different pubkeys? → Compare versions
   │  ├─ New version > Existing? → Keep NEW
   │  └─ Otherwise → Keep EXISTING
   └─ Both have same pubkey (or both none)? → Compare versions
      ├─ New version > Existing? → Keep NEW
      ├─ Versions equal? → Compare data count
      │  ├─ New has more data? → Keep NEW
      │  └─ Otherwise → Keep EXISTING
      └─ Otherwise → Keep EXISTING
```

## Data Count Calculation

The "data count" is calculated as:
```typescript
Object.values(node).filter(v => v !== undefined && v !== null).length
```

This counts all fields in the node object that have actual values (not undefined or null).

## Important Notes

1. **Pubkey is always preferred**: If one node has a pubkey and another doesn't (same IP), the one with pubkey always wins, regardless of version.

2. **Version comparison is string-based**: Uses simple string comparison (`>`), so "0.8.0" > "0.7.0", but "0.10.0" might be less than "0.9.0" depending on string comparison.

3. **First-come-first-served tiebreaker**: If versions and data counts are equal, the existing node is kept (first one encountered wins).

4. **IP-based nodes are deprecated**: The system prefers nodes with pubkeys. If a node is stored by IP (no pubkey) and a new node with the same IP has a pubkey, the IP-based one is deleted.

## Example Scenarios

### Example 1: Same pubkey, different IPs
- Node A: pubkey="ABC123", IP="192.168.1.1", version="0.7.0"
- Node B: pubkey="ABC123", IP="10.0.0.1", version="0.8.0"
- **Result**: Node B wins (higher version), IP mapping updated

### Example 2: Same IP, one has pubkey
- Node A: IP="192.168.1.1", pubkey=null, version="0.8.0"
- Node B: IP="192.168.1.1", pubkey="ABC123", version="0.7.0"
- **Result**: Node B wins (has pubkey, even though lower version)

### Example 3: Same IP, both have pubkeys, different versions
- Node A: IP="192.168.1.1", pubkey="ABC123", version="0.7.0"
- Node B: IP="192.168.1.1", pubkey="XYZ789", version="0.8.0"
- **Result**: Node B wins (higher version, even though different pubkey)

### Example 4: Same IP, same version, different data richness
- Node A: IP="192.168.1.1", version="0.7.0", 10 fields populated
- Node B: IP="192.168.1.1", version="0.7.0", 15 fields populated
- **Result**: Node B wins (more data fields)

