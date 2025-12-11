# Optimized Per-Node Latency Measurement

## Updated Implementation

The Cloudflare Worker now measures **each node individually** instead of assigning the same latency to all nodes.

## The Challenge

**Per-node measurement:**
- 159 nodes × 8 regions = 1,272 requests per refresh
- Per day: 1,272 × 60 × 24 = **1,831,680 requests/day**
- Cloudflare free tier: **100,000 requests/day** ❌

## Solutions to Stay Within Limits

### Option 1: Reduce Frequency + Fewer Regions (Recommended)
**Configuration:**
- Measure all 159 nodes individually
- From 4 key regions (US East, EU West, Asia East, Africa West)
- Every 10 minutes instead of 1 minute

**Usage:**
- 159 nodes × 4 regions = 636 requests per refresh
- Per day: 636 × (60/10) × 24 = **91,584 requests/day** ✅ (within limit!)

**Implementation:**
1. Update background refresh interval to 10 minutes
2. Only configure 4 region endpoints
3. All nodes still measured individually

**Pros:**
- ✅ All nodes measured individually
- ✅ Within Cloudflare free tier
- ✅ 10-minute intervals still good granularity
- ✅ 4 regions cover major user bases

### Option 2: Self-Hosted VPS (Best Data Quality)
**Configuration:**
- Deploy `measurement-server.js` to VPS in 4-8 regions
- Measure all nodes every minute
- No request limits

**Cost:**
- 4 VPS × $5/month = **$20/month**

**Pros:**
- ✅ All nodes measured individually
- ✅ Every minute (best granularity)
- ✅ No limits
- ✅ Full control

**Cons:**
- ❌ Costs $20/month
- ❌ Need to manage servers

### Option 3: Hybrid Approach
**Configuration:**
- Use Cloudflare for 4 regions (every 10 minutes)
- Use self-hosted VPS for 4 additional regions
- Or measure all nodes but only during peak hours

## Recommended: Option 1

**Why:**
- Free
- All nodes measured individually
- Good enough frequency (10 minutes)
- Easy to implement

**To implement:**
1. Update `background-refresh.ts` interval to 10 minutes
2. Configure only 4 region endpoints:
   ```env
   CF_WORKER_US_EAST=https://...
   CF_WORKER_EU_WEST=https://...
   CF_WORKER_ASIA_EAST=https://...
   CF_WORKER_AFRICA_WEST=https://...
   ```

**If you need more frequent updates:**
- Switch to Option 2 (self-hosted VPS)
- $20/month is very affordable
- Best data quality

## Current Behavior

**What happens now:**
1. Server collects all 159 node IPs
2. Calls Cloudflare Worker once per region with all IPs
3. Worker measures latency **for each node individually** (in parallel batches)
4. Returns latency map: `{ '1.2.3.4': 50, '5.6.7.8': 120, ... }`
5. Each node gets its own latency in `latencyByRegion`

**Note:** Currently measures proxy latency for each node (since nodes use proxy). If nodes expose direct endpoints, we can measure direct latency instead.

