# Can We Query Nodes Directly?

## The Answer: YES, but...

### What We Can Do

**Direct Node Queries:**
- Nodes expose pRPC endpoints on ports **6000** or **9000**
- We can query them directly: `http://node-ip:6000/rpc`
- We already do this! See `callPRPCMultiPort` function

**What Works:**
- ✅ ~11 public nodes (in `PUBLIC_PRPC_ENDPOINTS`) - these are publicly accessible
- ✅ We already try direct queries as fallback in `fetchNodeStats`
- ✅ Code tries ports: `node.rpcPort`, then `6000`, then `9000`

**What Doesn't Work:**
- ❌ Most nodes (~148 out of 159) are **NOT publicly accessible**
- ❌ They're behind firewalls/NAT
- ❌ Direct queries to these nodes will timeout/fail
- ❌ That's why proxy exists - to access nodes that aren't public

## Current Implementation

**What we're doing now:**
1. Try proxy latency first (works for all nodes)
2. Fallback: Try direct node endpoint (port 6000/9000)
3. Most direct queries fail (nodes not public)

**The code:**
```typescript
// In fetchNodeStats:
if (ip) {
  const portsToTry = node.rpcPort ? [node.rpcPort, 6000, 9000] : [6000, 9000];
  for (const port of portsToTry) {
    const measuredLatency = await measureLatencyTTFB(ip, port, 2000);
    if (measuredLatency !== null) {
      latency = measuredLatency; // Direct node latency!
      break;
    }
  }
}
```

## So What's The Real Solution?

### Option 1: Measure Direct Latency for ALL Nodes (Try It)
**Approach:**
- Try direct pRPC endpoint for every node
- Most will fail (timeout), but some will succeed
- Use direct latency when available, proxy latency as fallback

**Pros:**
- ✅ Real per-node latency for accessible nodes
- ✅ No fake variation
- ✅ Accurate data

**Cons:**
- ⚠️ Most requests will timeout (slow)
- ⚠️ Still need to measure from multiple regions
- ⚠️ 159 nodes × 4 regions = 636 requests (but many will timeout quickly)

**Implementation:**
- Update Deno Deploy worker to try direct node endpoint first
- If direct fails, fallback to proxy latency
- Store both: `directLatency` and `proxyLatency`

### Option 2: Measure Direct Latency for Public Nodes Only
**Approach:**
- Only measure direct latency for ~11 public nodes
- Use proxy latency for rest

**Pros:**
- ✅ Efficient (only 11 nodes × 4 regions = 44 requests)
- ✅ Real data for public nodes
- ✅ Within limits

**Cons:**
- ⚠️ Only ~11 nodes have direct latency

### Option 3: Try Direct for All, Accept Failures
**Approach:**
- Try direct endpoint for all nodes
- Accept that most will fail/timeout
- Use proxy latency when direct fails

**Pros:**
- ✅ Real per-node latency where available
- ✅ No assumptions

**Cons:**
- ⚠️ Slow (many timeouts)
- ⚠️ But timeouts are fast (2s), so acceptable

## Recommendation

**Do Option 3: Try Direct for All Nodes**

**Why:**
- We're already trying direct queries as fallback
- Timeouts are fast (2s)
- We get real per-node latency where available
- No fake variation needed

**Implementation:**
1. Update Deno Deploy worker to try direct node endpoint: `http://node-ip:6000/rpc`
2. If direct fails/timeout, use proxy latency
3. Store: `directLatency` (if available) or `proxyLatency` (fallback)
4. Display direct latency when available, proxy latency otherwise

**Result:**
- Real per-node latency for ~11 public nodes
- Proxy latency for ~148 private nodes
- No fake variation
- Accurate data

Want me to implement this?

