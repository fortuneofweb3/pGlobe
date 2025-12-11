# Per-Node Latency Measurement Solution

## The Problem

**Requirement:** Measure latency for each node individually (nodes can have different latencies)

**Challenge:** 
- 159 nodes × 8 regions = 1,272 requests per refresh
- Per day: 1,272 × 60 × 24 = **1,831,680 requests/day**
- Cloudflare free tier: **100,000 requests/day** ❌

## Solutions

### Option 1: Reduce Frequency + Fewer Regions (Recommended)
**Approach:**
- Measure all nodes from 4 key regions (US East, EU West, Asia East, Africa West)
- Refresh every 10 minutes instead of 1 minute
- Still gives good data granularity

**Usage:**
- 159 nodes × 4 regions = 636 requests per refresh
- Per day: 636 × (60/10) × 24 = **91,584 requests/day** ✅ (within limit!)

**Pros:**
- ✅ Measures all nodes individually
- ✅ Within Cloudflare free tier
- ✅ Still frequent enough (6 measurements/hour)

**Cons:**
- ⚠️ Less frequent updates (every 10 min vs 1 min)
- ⚠️ Only 4 regions (but covers major user bases)

### Option 2: Rotating Sample
**Approach:**
- Measure 20 nodes per region each refresh
- Rotate which nodes are measured
- After 8 refreshes, all nodes measured

**Usage:**
- 20 nodes × 8 regions = 160 requests per refresh
- Per day: 160 × 60 × 24 = **230,400 requests/day** ❌ (still exceeds)

**Better:**
- 20 nodes × 4 regions = 80 requests per refresh
- Per day: 80 × 60 × 24 = **115,200 requests/day** ❌ (still exceeds)

**Even Better:**
- 20 nodes × 4 regions, every 5 minutes
- Per day: 80 × (60/5) × 24 = **23,040 requests/day** ✅

**Pros:**
- ✅ Well within limits
- ✅ Frequent updates

**Cons:**
- ❌ Not all nodes measured each refresh
- ❌ Takes 8 refreshes to measure all nodes

### Option 3: Self-Hosted VPS
**Approach:**
- Deploy measurement servers to VPS in 4 regions
- No request limits
- Measure all nodes every minute

**Cost:**
- 4 VPS × $5/month = **$20/month**

**Pros:**
- ✅ No limits
- ✅ Measure all nodes every minute
- ✅ Full control

**Cons:**
- ❌ Costs money
- ❌ Need to manage servers

### Option 4: Hybrid Approach
**Approach:**
- Use Cloudflare for 4 key regions (reduced frequency)
- Use self-hosted VPS for 4 additional regions
- Or measure all nodes but only during peak hours

## Recommendation

**Use Option 1: Reduce Frequency + Fewer Regions**

**Implementation:**
1. Measure all 159 nodes individually
2. From 4 key regions (US East, EU West, Asia East, Africa West)
3. Every 10 minutes instead of 1 minute
4. **91,584 requests/day** (within 100k limit)

**Why this works:**
- ✅ All nodes measured individually
- ✅ Within Cloudflare free tier
- ✅ 10-minute intervals still provide good granularity
- ✅ 4 regions cover major user bases

## Alternative: If You Need More Frequent Updates

**Use Option 3: Self-Hosted VPS**
- $20/month for 4 regions
- Measure all nodes every minute
- No limits
- Full control

This is still very affordable and gives you the best data quality.

