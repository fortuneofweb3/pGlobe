# Free Alternatives for Multi-Region Latency Measurement

## Free Edge Computing Platforms

### 1. **Vercel Edge Functions** ✅ (Best Alternative)
**Free Tier:**
- 100GB-hours compute time/month
- Unlimited requests
- Global edge network

**Usage Estimate:**
- 159 nodes × 4 regions × every 10 min = 91,584 requests/day
- ~2.7M requests/month ✅ (well within limits)

**Pros:**
- ✅ Free tier is generous
- ✅ Global edge network
- ✅ Easy deployment (if you're on Vercel)
- ✅ Similar API to Cloudflare Workers

**Cons:**
- ⚠️ Requires Vercel deployment
- ⚠️ Less regions than Cloudflare

**Setup:** Deploy edge functions to Vercel, same code as Cloudflare Workers

---

### 2. **Netlify Edge Functions** ✅
**Free Tier:**
- 125,000 requests/month
- 100GB bandwidth/month

**Usage Estimate:**
- 91,584 requests/day = 2.7M requests/month ❌ (exceeds limit)

**Pros:**
- ✅ Free tier available
- ✅ Global edge network

**Cons:**
- ❌ Request limit too low for your use case
- ⚠️ Requires Netlify deployment

---

### 3. **Deno Deploy** ✅ (Great Option!)
**Free Tier:**
- Unlimited requests
- 100,000 CPU-ms/day per project
- Global edge network

**Usage Estimate:**
- Unlimited requests ✅
- CPU time: ~10ms per request × 91,584 = 915,840ms/day ✅ (within limit)

**Pros:**
- ✅ Unlimited requests
- ✅ Free tier is generous
- ✅ Global edge network
- ✅ Easy deployment
- ✅ No vendor lock-in

**Cons:**
- ⚠️ Uses Deno runtime (not Node.js, but similar)

**Setup:** Deploy Deno script, very similar to Cloudflare Workers

---

### 4. **Cloudflare Workers** ✅ (Current Choice)
**Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request

**Usage Estimate:**
- 91,584 requests/day ✅ (within limit)

**Pros:**
- ✅ Free tier sufficient
- ✅ Best global edge network
- ✅ Easy setup

**Cons:**
- ⚠️ Request limit (but sufficient for your needs)

---

### 5. **RIPE Atlas** (Free but Limited)
**Free Tier:**
- 100 credits/day
- Limited probe locations
- API access

**Usage Estimate:**
- 1 credit per measurement
- 100 measurements/day ❌ (not enough)

**Pros:**
- ✅ Free
- ✅ Real network probes worldwide

**Cons:**
- ❌ Very limited free tier
- ❌ Not suitable for your volume
- ⚠️ More complex API

---

### 6. **Globalping API** (Free)
**Free Tier:**
- Free API access
- Multiple locations
- Rate limits apply

**Usage Estimate:**
- Unknown rate limits
- May have restrictions

**Pros:**
- ✅ Free
- ✅ Multiple locations

**Cons:**
- ⚠️ Unknown rate limits
- ⚠️ May not support programmatic batch requests
- ⚠️ Less control

---

### 7. **Fly.io** (Free Tier Available)
**Free Tier:**
- 3 shared VMs
- 160GB outbound data/month
- Multiple regions

**Usage Estimate:**
- 91,584 requests/day × ~1KB = ~91MB/day = ~2.7GB/month ✅

**Pros:**
- ✅ Free tier available
- ✅ Multiple regions
- ✅ Full control

**Cons:**
- ⚠️ Limited to 3 VMs (can deploy to 3 regions)
- ⚠️ More setup than edge functions

---

### 8. **Railway** (Free Trial)
**Free Tier:**
- $5 credit/month (trial)
- Multiple regions

**Usage Estimate:**
- Small projects free
- May exceed free tier

**Pros:**
- ✅ Free trial
- ✅ Easy deployment

**Cons:**
- ❌ Not truly free long-term
- ⚠️ May cost after trial

---

## Comparison Table

| Platform | Free Tier | Requests/Month | Best For |
|----------|-----------|----------------|----------|
| **Vercel Edge** | ✅ Generous | Unlimited* | Vercel users |
| **Deno Deploy** | ✅ Very Good | Unlimited | Best free option |
| **Cloudflare Workers** | ✅ Good | 3M/day | Current choice |
| **Netlify Edge** | ⚠️ Limited | 125k/month | Small projects |
| **Fly.io** | ✅ Good | Unlimited | Full control |
| **RIPE Atlas** | ❌ Too Limited | 100/day | Research only |
| **Globalping** | ✅ Unknown | Unknown | Experimental |

*Vercel has compute time limits, but requests are unlimited

## Recommendation

### Best Free Options (Ranked):

1. **Deno Deploy** 🥇
   - Unlimited requests
   - Generous CPU time
   - Global edge network
   - Easy deployment
   - **Best overall free option**

2. **Vercel Edge Functions** 🥈
   - If you're already on Vercel
   - Generous free tier
   - Easy integration

3. **Cloudflare Workers** 🥉
   - Current choice
   - Good free tier
   - Best edge network

4. **Fly.io** 🏅
   - If you need more control
   - Free tier available
   - Can deploy to 3 regions free

## Quick Setup: Deno Deploy

**Why Deno Deploy:**
- ✅ Unlimited requests (best for per-node measurement)
- ✅ Free tier is generous
- ✅ Global edge network
- ✅ Easy deployment

**Setup:**
1. Create account at [deno.com/deploy](https://deno.com/deploy)
2. Deploy edge function (similar code to Cloudflare Worker)
3. Set environment variables
4. Done!

**Code:** Very similar to Cloudflare Worker, just uses Deno runtime instead of Cloudflare Workers runtime.

## Conclusion

**For your use case (per-node measurement):**
- **Deno Deploy** is the best free option (unlimited requests!)
- **Vercel Edge** is great if you're on Vercel
- **Cloudflare Workers** is still good (within limits with optimization)
- **Fly.io** if you need more control

**Recommendation:** Try **Deno Deploy** first - it has unlimited requests which is perfect for per-node measurement!

