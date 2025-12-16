# Node Filtering Analysis

## Summary
- **pRPC API returns**: 198 nodes
- **Site displays**: 189 nodes  
- **Difference**: 9 nodes filtered out

## Filtering Flow

### 1. Initial Fetch from pRPC (`lib/server/prpc.ts`)
**Location**: `fetchPodsWithStatsFromEndpoint()` (line ~548-595)

**Filter Criteria**:
- Nodes without valid Solana pubkeys are filtered out
- Uses `isValidPubkey()` function to validate
- Logs: `[pRPC] Skipping node with invalid pubkey: {pubkey} (address: {address})`

**What gets filtered**:
- Nodes with missing pubkey
- Nodes with invalid pubkey format
- Nodes with pubkey that doesn't pass Solana PublicKey validation

### 2. Background Refresh Filtering (`lib/server/background-refresh.ts`)
**Location**: `performRefresh()` (line ~88-98)

**Filter Criteria**:
- Same as above - filters nodes without valid pubkeys
- This is a redundant check (nodes already filtered in step 1)
- Logs: `[BackgroundRefresh] ⚠️  {count} nodes filtered out (invalid or missing pubkey)`

### 3. MongoDB Upsert (`lib/server/mongodb-nodes.ts`)
**Location**: `upsertNodes()` (line ~473-795)

**Deduplication Logic**:
- Deduplicates by pubkey first (if same pubkey exists, keeps better version)
- Then deduplicates by IP address (if same IP, keeps node with pubkey over one without)
- Priority: pubkey > latest version > more data fields

**What gets removed**:
- Duplicate nodes with same pubkey (keeps the better one)
- Duplicate nodes with same IP (keeps the one with pubkey, or better version)

**Note**: This shouldn't reduce the count if all nodes have unique pubkeys, but may remove duplicates.

### 4. MongoDB Read (`lib/server/mongodb-nodes.ts`)
**Location**: `getAllNodes()` (line ~800-847)

**No filtering** - Returns all nodes from MongoDB collection

## Pubkey Validation Rules (`lib/server/mongodb-nodes.ts`, line ~250-274)

A pubkey is considered **invalid** if:
1. Missing or null/undefined
2. Less than 32 characters
3. More than 44 characters
4. Contains whitespace
5. Looks like an IP address (matches pattern `^\d+\.\d+\.\d+\.\d+`)
6. Matches invalid pattern like `pubkey10`, `pubkey123`, etc.
7. Is only numbers
8. Fails Solana PublicKey constructor validation (not valid base58)

## Where to Find Filtered Nodes

### In Logs:
1. **pRPC logs**: Look for `[pRPC] Skipping node with invalid pubkey: ...`
2. **Background refresh logs**: Look for `[BackgroundRefresh] ⚠️  X nodes filtered out (invalid or missing pubkey)`
3. **MongoDB logs**: Look for `[MongoDB] Skipping node with invalid pubkey: ...`

### To Identify Specific Filtered Nodes:

1. **Compare pRPC response with MongoDB**:
   - Call pRPC endpoint: `curl -X POST http://192.190.136.28:6000/rpc -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "method": "get-pods-with-stats", "id": 1}' | jq '.result.pods[] | {pubkey: .pubkey, address: .address}'`
   - Get MongoDB nodes: Check `/api/pnodes` endpoint
   - Compare pubkeys to find which ones are missing

2. **Check logs**:
   - Server logs should show which specific nodes were filtered
   - Look for addresses/pubkeys in the skip messages

3. **Manual validation**:
   - Take the 198 nodes from pRPC
   - Run each through `isValidPubkey()` function
   - The 9 that fail are the filtered ones

## Potential Reasons for 9 Missing Nodes

1. **Invalid pubkeys**: Nodes with malformed or invalid Solana public keys
2. **Missing pubkeys**: Nodes that don't have a pubkey field at all
3. **IP addresses as pubkeys**: Nodes where pubkey field contains an IP address instead
4. **Duplicate pubkeys**: If there are duplicates, only one is kept
5. **Duplicate IPs**: If same IP has multiple entries, deduplication may remove some

## Next Steps to Identify Filtered Nodes

1. Add detailed logging to capture which specific nodes are filtered
2. Create a diagnostic endpoint that compares pRPC response with MongoDB
3. Export filtered nodes to a file for analysis
4. Add metrics to track filtering reasons (invalid pubkey, duplicate, etc.)

