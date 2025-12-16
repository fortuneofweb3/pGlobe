# Filtered Nodes Analysis

## Summary

- **pRPC returns**: 198 nodes
- **Valid pubkeys**: 196 nodes
- **Filtered out (invalid pubkey)**: 2 nodes
- **Expected in DB**: 196 nodes
- **Actually in DB**: 189 nodes (as reported by user)
- **Missing from DB**: 7 nodes (196 - 189 = 7)

## Nodes Filtered Due to Invalid Pubkeys (2 nodes)

### 1. Missing Pubkey
- **Address**: `149.102.137.195:9001`
- **Pubkey**: (missing)
- **Version**: unknown
- **Reason**: No pubkey field in pRPC response

### 2. Invalid Pubkey (Too Short)
- **Address**: `127.0.0.1:9015`
- **Pubkey**: `TestPubkey14`
- **Version**: `1.0.0`
- **Reason**: Pubkey is only 12 characters (minimum is 32 for Solana pubkeys)
- **Validation**: Fails because `TestPubkey14.length = 12 < 32`

## Additional Missing Nodes (7 nodes)

These 7 nodes have **valid pubkeys** but are still missing from the database. Possible reasons:

### Possible Causes:

1. **Deduplication**: Same pubkey with different IPs - one was kept, others removed
2. **Same IP, different pubkeys**: IP-based deduplication removed some
3. **MongoDB write failures**: Nodes failed to write during upsert
4. **Timing issues**: Nodes appeared in pRPC but weren't processed in time
5. **Cleanup operations**: Nodes were removed by cleanup functions

## Next Steps to Identify the 7 Missing Nodes

### Option 1: Run the comparison script
```bash
cd "/Users/fortune/Documents/Workflows/Xandeum Analytics"
node scripts/compare-nodes.js
```

This will:
- Analyze pRPC response (already done)
- Fetch nodes from database via API
- Compare pubkeys
- List which nodes are missing

**Requirements**:
- Set `RENDER_API_URL` environment variable (or it will try localhost:3001)
- Set `API_SECRET` if authentication is required

### Option 2: Manual comparison

1. **Export pRPC pubkeys**:
```bash
cat /tmp/prpc_response.json | jq '.result.pods[] | {pubkey: .pubkey, address: .address}' | jq -s 'map(select(.pubkey != null)) | map(.pubkey)' > /tmp/prpc_pubkeys.json
```

2. **Export DB pubkeys** (via API or MongoDB):
```bash
# Via API (if available)
curl -H "Authorization: Bearer $API_SECRET" "$RENDER_API_URL/api/pnodes" | jq '.nodes[].pubkey' > /tmp/db_pubkeys.json

# Or directly from MongoDB
# mongosh "your-connection-string" --eval "db.nodes.find({}, {pubkey: 1}).toArray()" > /tmp/db_pubkeys.json
```

3. **Compare**:
```bash
# Find pubkeys in pRPC but not in DB
comm -23 <(sort /tmp/prpc_pubkeys.json) <(sort /tmp/db_pubkeys.json) > /tmp/missing_pubkeys.txt
```

### Option 3: Check server logs

Look for:
- `[MongoDB] Skipping node with invalid pubkey: ...`
- `[BackgroundRefresh] ⚠️  X nodes filtered out (invalid or missing pubkey)`
- `[MongoDB] ✅ Wrote X new nodes, updated Y existing nodes, deleted Z IP-based duplicates`

## Validation Rules Applied

A pubkey is considered **invalid** if:
1. Missing or null/undefined
2. Less than 32 characters
3. More than 44 characters
4. Contains whitespace
5. Looks like an IP address (matches `^\d+\.\d+\.\d+\.\d+`)
6. Matches invalid pattern like `pubkey10`, `pubkey123`
7. Is only numbers
8. Fails Solana PublicKey constructor validation (not valid base58)

## Files Generated

- `/tmp/prpc_response.json` - Full pRPC response
- `/tmp/filtered_nodes.json` - Nodes filtered due to invalid pubkeys
- `/tmp/missing_from_db.json` - Nodes in pRPC but not in DB (if comparison script runs)

## Recommendations

1. **Investigate the 7 missing nodes**: Run comparison to see which specific nodes are missing
2. **Check deduplication logic**: Verify if same pubkey/different IP cases are handled correctly
3. **Review MongoDB logs**: Check for write failures or errors during upsert
4. **Consider the merge strategy**: Implement the proposed merge strategy for same pubkey/different IP cases

