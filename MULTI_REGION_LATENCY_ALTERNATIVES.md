# Multi-Region Latency Measurement - Alternatives & Limits

## Cloudflare Workers Limits

**Free Tier:**
- 100,000 requests/day
- 1,000 requests/minute
- 10ms CPU time per request

**Our Usage Estimate:**
- ~159 nodes
- 8 regions
- Refresh every 1 minute
- **Per refresh:** 159 nodes × 8 regions = **1,272 requests**
- **Per day:** 1,272 × 60 × 24 = **1,831,680 requests/day** ❌

**We'd exceed free tier limits by ~18x!**

## Alternatives

### Option 1: Batch Measurement (Recommended)
Instead of calling workers per-node, batch multiple nodes per worker call:

**Approach:**
- Single worker call per region with all node IPs
- Worker measures latency to all nodes in parallel
- Returns `{ nodeIp: latency }` map

**Usage:**
- 8 regions × 1 request = **8 requests per refresh**
- **Per day:** 8 × 60 × 24 = **11,520 requests/day** ✅ (well within limits)

### Option 2: Measure Subset of Nodes
Only measure latency for:
- Top 50 nodes by importance
- Or nodes that users frequently access
- Or sample randomly

**Usage:**
- 50 nodes × 8 regions = **400 requests per refresh**
- **Per day:** 400 × 60 × 24 = **576,000 requests/day** ❌ (still exceeds)

### Option 3: Reduce Refresh Frequency
Measure latency less frequently:
- Every 5 minutes instead of every 1 minute
- Or only during peak hours

**Usage (every 5 min):**
- 159 nodes × 8 regions = **1,272 requests per refresh**
- **Per day:** 1,272 × (60/5) × 24 = **366,336 requests/day** ❌ (still exceeds)

### Option 4: Use Fewer Regions
Measure from only 4-5 key regions instead of 8:
- US East, EU West, Asia East, Africa West
- Skip less critical regions

**Usage:**
- 159 nodes × 4 regions = **636 requests per refresh**
- **Per day:** 636 × 60 × 24 = **915,840 requests/day** ❌ (still exceeds)

### Option 5: Hybrid Approach (Best)
Combine batching + reduced frequency + fewer regions:

**Approach:**
- Batch all nodes per region (8 requests per refresh)
- Measure every 5 minutes
- Use 4-5 key regions

**Usage:**
- 5 regions × 1 batch request = **5 requests per refresh**
- **Per day:** 5 × (60/5) × 24 = **1,440 requests/day** ✅✅✅ (very safe)

### Option 6: Vercel Edge Functions
Similar to Cloudflare Workers but different limits:
- Free tier: 100GB-hours compute time
- May be more suitable for our use case

### Option 7: Self-Hosted Edge Servers
Deploy lightweight measurement scripts to:
- VPS in different regions (DigitalOcean, Linode, etc.)
- AWS Lambda in multiple regions
- Google Cloud Functions

**Cost:** ~$5-10/month per region

## Recommendation

**Use Option 5 (Hybrid Approach):**
1. **Batch measurement:** Single worker call per region with all node IPs
2. **Reduced frequency:** Measure every 5 minutes (still frequent enough)
3. **Key regions only:** US East, EU West, Asia East, Africa West (4 regions)

This gives us:
- ✅ Well within Cloudflare free tier limits
- ✅ Still provides accurate multi-region latency
- ✅ No additional costs
- ✅ Easy to scale up later if needed

