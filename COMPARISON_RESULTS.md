# Node Comparison Results - Complete Analysis

## Executive Summary

- **pRPC Total**: 198 nodes
- **pRPC Valid Unique Pubkeys**: 179 nodes (after deduplication)
- **Database Nodes**: 189 nodes
- **Missing from DB**: 3 nodes
- **Extra in DB**: 13 nodes (not in current gossip)
- **Duplicate Pubkeys in pRPC**: 4 nodes (same pubkey, different IPs)

## Key Findings

### 1. Nodes Filtered Due to Invalid Pubkeys (2 nodes)

These are correctly filtered and should NOT be in the database:

1. **Missing Pubkey**
   - Address: `149.102.137.195:9001`
   - Reason: No pubkey field in pRPC response

2. **Invalid Pubkey (Too Short)**
   - Address: `127.0.0.1:9015`
   - Pubkey: `TestPubkey14` (only 12 chars, needs 32+)
   - Version: `1.0.0`
   - Reason: Fails length validation

### 2. Nodes Missing from Database (3 nodes)

These nodes have **valid pubkeys** and are in pRPC but NOT in the database:

1. **Pubkey**: `E4n5aPdtWmBvU2x8oLxx5UMTPQoRDK5t9e8XCoekarLe`
   - Address: `154.38.171.140:9001`
   - Version: `0.8.0-trynet.20251212183600.9eea72e`

2. **Pubkey**: `DoyF9Ex83JtRThuwrpwJaacSu8yZWQ2UUohRM6swrtzD`
   - Address: `154.38.170.117:9001`
   - Version: `0.8.0-trynet.20251212183600.9eea72e`

3. **Pubkey**: `8rTJCEe6bPcfbi8JgYbHNzSZFy1ADubieYS2wQdRfCXX`
   - Address: `154.38.175.38:9001`
   - Version: `0.8.0-trynet.20251212183600.9eea72e`

**Possible Reasons:**
- These are all `trynet` versions - might be filtered somewhere?
- MongoDB write failed during upsert
- Deduplication removed them (unlikely, they have unique pubkeys)
- Timing issue (appeared in pRPC but not processed yet)

### 3. Duplicate Pubkeys in pRPC (4 nodes - CRITICAL ISSUE)

These nodes have the **same pubkey but different IP addresses**. This is causing deduplication where only one IP is kept:

#### Duplicate 1: `8PjjPkizL4JZ54sPzNdX...` (5 different IPs!)
- `94.255.130.13:12800`
- `94.255.130.154:1792`
- `100.79.200.164:9001`
- `217.76.50.220:21134`
- `94.255.129.178:8717`
- **Issue**: Same node, 5 different IPs - only 1 is kept in DB!

#### Duplicate 2: `7dhiz2URAj84PA439YP9...` (3 different IPs)
- `95.217.108.120:9001`
- `62.171.148.52:9001`
- `95.216.96.113:9001`
- **Issue**: Same node, 3 different IPs - only 1 is kept!

#### Duplicate 3: `FbqU9um5MVSbdHDMSwCx...` (2 different IPs)
- `185.196.21.150:9001`
- `216.234.134.1:45660`
- **Issue**: Same node, 2 different IPs - only 1 is kept!

#### Duplicate 4: `4mdBqZATb3HxaXV3Djjx...` (11 different IPs!!!)
- `105.116.14.236:53227`
- `105.116.7.203:4548`
- `102.90.102.41:23211`
- `105.116.3.132:10608`
- `102.90.99.199:38178`
- `105.116.9.65:44478`
- `105.116.12.65:64350`
- `105.113.12.48:31542`
- `105.116.9.183:5360`
- `105.116.7.80:50916`
- `105.116.1.203:43914`
- **Issue**: Same node, 11 different IPs - only 1 is kept! This is a major data loss.

**Total Impact**: 
- 4 unique pubkeys
- 21 total IP addresses (5 + 3 + 2 + 11)
- Only 4 nodes stored in DB (one per pubkey)
- **17 IP addresses lost** due to deduplication!

### 4. Extra Nodes in Database (13 nodes)

These nodes are in the database but NOT in current pRPC response:
- 12 nodes: Not seen in gossip (likely offline/stale)
- 1 node: Seen in gossip but not in pRPC response (might be timing issue)

These are expected - they're historical nodes that are no longer active.

## The Real Problem

### Why 198 pRPC → 189 DB?

1. **2 nodes filtered** (invalid pubkeys) ✅ Correct
2. **17 nodes lost** due to duplicate pubkey deduplication ❌ Problem
3. **3 nodes missing** (trynet versions?) ❓ Need investigation
4. **13 extra in DB** (stale/offline nodes) ✅ Expected

**Math Check:**
- 198 total pRPC
- -2 invalid pubkeys = 196 valid
- -17 duplicate IPs (21 IPs - 4 kept) = 179 unique pubkeys
- But we have 189 in DB, so there are 10 extra nodes (stale/offline)

**Actual Issue:**
The **17 nodes lost due to duplicate pubkey deduplication** is the main problem. When a node has the same pubkey but different IPs, the current logic keeps only ONE IP address. This causes:
- Data loss (we lose track of IP changes)
- Incorrect node counts
- Missing nodes in the display

## Recommendations

### Immediate Fix: Implement Merge Strategy

As proposed in `MERGE_STRATEGY_PROPOSAL.md`, we should:

1. **Merge nodes with same pubkey** instead of replacing
2. **Track previous addresses** in `previousAddresses` array
3. **Use current gossip address** as the active one
4. **Preserve all data** from both entries

This would:
- Save all 21 IP addresses (not just 4)
- Track IP changes over time
- Show correct node count
- Preserve historical data

### Investigation Needed

1. **Why are 3 trynet nodes missing?**
   - Check if there's version filtering
   - Check MongoDB write logs
   - Verify they're not being filtered elsewhere

2. **Why do nodes have duplicate pubkeys?**
   - Are these actually the same node moving IPs?
   - Or are there multiple nodes sharing a pubkey (shouldn't happen)?
   - Check if these are test/dev nodes

## Files Generated

- `/tmp/missing_from_db.json` - 3 nodes missing from DB
- `/tmp/duplicate_pubkeys.json` - 4 nodes with duplicate pubkeys
- `/tmp/prpc_valid_pubkeys.txt` - All valid pubkeys from pRPC
- `/tmp/prpc_valid_nodes.json` - Full node details

## Next Steps

1. ✅ **Identified the issue**: Duplicate pubkey deduplication is losing 17 nodes
2. ⏳ **Implement merge strategy**: Track IP changes instead of replacing
3. ⏳ **Investigate 3 missing trynet nodes**: Check if version filtering exists
4. ⏳ **Update deduplication logic**: Merge instead of replace for same pubkey

