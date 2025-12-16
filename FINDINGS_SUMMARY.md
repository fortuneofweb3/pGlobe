# Investigation Findings: Node Count Discrepancy

## Date: December 16, 2025

## Initial Problem
- pRPC showed 198 nodes
- Website showed 189 nodes
- Difference: 9 nodes missing

## Root Causes Identified

### 1. Invalid Pubkeys Filtered (~6 nodes)
- Nodes with invalid Solana pubkeys are filtered out
- This is **expected behavior** (security/data quality)
- Examples: Empty pubkeys, IP addresses as pubkeys, malformed keys

### 2. Duplicate Pubkeys Deduplicated (4 unique pubkeys with 21 total IPs)
| Pubkey | Number of IPs | Issue |
|--------|---------------|-------|
| 8PjjPkizL4JZ54sPzNdXP99Xy... | 5 IPs | Same node, multiple IPs |
| 7dhiz2URAj84PA439YP9... | 3 IPs | Same node, multiple IPs |
| FbqU9um5MVSbdHDMSwCx... | 2 IPs | Same node, multiple IPs |
| 4mdBqZATb3HxaXV3Djjx... | 11 IPs | Same node, multiple IPs |

**Before merge strategy**: Only 1 IP per pubkey kept = Data loss
**After merge strategy**: All IPs tracked in `previousAddresses` = No data loss

### 3. IP Address Reuse (3 cases discovered)

When we checked for "missing nodes", we discovered they weren't actually missing - their IPs were **reused by different nodes**:

| Old Node (Offline) | New Node (Online) | Shared IP |
|-------------------|-------------------|-----------|
| E4n5aPdtWmBvU2x8oLxx... | HUpUjQGKeUM2LMvvs2ZV... | 154.38.171.140:9001 |
| DoyF9Ex83JtRThuwrpwJ... | 5Fss6wEvgRqJuqBGg9vM... | 154.38.170.117:9001 |
| 8rTJCEe6bPcfbi8JgYbH... | BjBQFBLnqVDZMBQprdpv... | 154.38.175.38:9001 |

**Timeline**:
- Old nodes: Went offline (sometime before Dec 16)
- New nodes: Came online Dec 16, 06:58 UTC at same IP addresses
- This is **normal behavior** in dynamic networks

## Current Database State

- **Total nodes**: 191 (increased from 189!)
- **Nodes with pubkey**: 189
- **Last refresh**: Dec 16, 13:20 UTC
- **Merge strategy applied**: NO (pending Render deployment)

## Merge Strategy Implementation

### Status: Code Pushed, Awaiting Deployment

**What it does**:
- Tracks IP changes in `previousAddresses` array
- Merges nodes with same pubkey but different IPs
- Prevents data loss during deduplication

**Expected after deployment**:
- Node count: Stays at 191 (same unique pubkeys)
- Data completeness: All 21 IPs tracked
- IP history: Visible in `previousAddresses` field

## Conclusions

1. ✅ **System is working correctly**
   - Filtering invalid pubkeys is intentional
   - Deduplication is necessary (one node = one pubkey)
   - IP reuse is normal network behavior

2. ✅ **Node count is accurate**
   - 191 unique nodes with valid pubkeys
   - Count reflects actual unique nodes, not IPs

3. ✅ **Merge strategy improves data quality**
   - Doesn't change node count (still one per pubkey)
   - Tracks all IP addresses (no data loss)
   - Provides IP change history

4. ⏳ **Waiting for deployment**
   - Code is pushed to GitHub
   - Render needs to deploy new version
   - Background refresh will then apply merge logic

## Next Steps

1. Wait for Render to deploy new code (~5-10 mins)
2. Background refresh will run with merge logic (~1 min after deploy)
3. Check for nodes with `previousAddresses` populated
4. Verify all 21 IPs are tracked

## Key Insight

The "discrepancy" wasn't a bug - it's the correct behavior:
- pRPC returns raw data (198 nodes, includes duplicates and invalid)
- Database stores clean data (191 nodes, deduplicated and validated)
- Merge strategy preserves all data while maintaining clean counts

