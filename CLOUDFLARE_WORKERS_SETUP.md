# Cloudflare Workers Setup Guide

## Why Cloudflare Workers?

- ✅ **Better region detection** - Exposes `request.cf.colo` (actual edge location)
- ✅ **More edge locations** - 300+ locations globally
- ✅ **Free tier** - 100,000 requests/day per worker
- ✅ **Better than Deno Deploy** - At least tells you which region it's running from

**Note:** Cloudflare Workers still route dynamically, but they expose the actual region via `cf.colo`, which is better than Deno Deploy.

## Step-by-Step Setup

### Step 1: Create Cloudflare Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up / Sign in
3. Go to **Workers & Pages** section

### Step 2: Create First Worker (US East)

1. Click **"Create Application"** → **"Create Worker"**
2. **Worker Name:** `latency-us-east`
3. Click **"Deploy"** (we'll add code next)
4. Click **"Edit code"** or **"Quick Edit"**

### Step 3: Add Code

1. **Delete** all default code
2. **Copy** entire contents of `cloudflare-worker-latency.js`
3. **Paste** into editor
4. Click **"Save and Deploy"**

### Step 4: Set Environment Variable

1. Go to **"Settings"** → **"Variables"**
2. Click **"Add variable"**
3. **Variable name:** `REGION`
4. **Value:** `us-east`
5. Click **"Save"**

### Step 5: Get Worker URL

After deployment, you'll see:
- **Worker URL:** `https://latency-us-east.YOUR_SUBDOMAIN.workers.dev`

Copy this URL!

### Step 6: Repeat for Other Regions

Do steps 2-5 for:
- `latency-eu-west` (REGION=eu-west)
- `latency-asia-east` (REGION=asia-east)
- `latency-africa-west` (REGION=africa-west)

**Note:** Use the same code (`cloudflare-worker-latency.js`) for all workers.

## Environment Variables to Set

After deploying all 4 workers, add these to your **Render** and **Vercel**:

```env
CF_WORKER_US_EAST=https://latency-us-east.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_EU_WEST=https://latency-eu-west.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_ASIA_EAST=https://latency-asia-east.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_AFRICA_WEST=https://latency-africa-west.YOUR_SUBDOMAIN.workers.dev
```

## Test Your Deployment

```bash
curl -X POST https://latency-us-east.YOUR_SUBDOMAIN.workers.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

Expected response:
```json
{
  "success": true,
  "region": "us-east",
  "cfColo": "DFW",  // Actual Cloudflare edge location
  "cfCountry": "US",
  "latencies": {
    "173.212.203.145": 43
  }
}
```

## Verify Region Detection

The response includes:
- `region`: Your env var (us-east, eu-west, etc.)
- `cfColo`: **Actual Cloudflare edge location** (e.g., "DFW", "LHR", "SIN")
- `cfCountry`: Country code (e.g., "US", "GB", "SG")

This tells you where the worker is **actually** running from!

## Cloudflare Workers Limits

**Free Tier:**
- ✅ 100,000 requests/day per worker
- ✅ 10ms CPU time per request
- ✅ 50ms total execution time

**For 4 workers, 159 nodes, every 10 minutes:**
- 159 nodes × 4 regions = 636 requests per refresh
- 636 × (60/10) × 24 = **91,584 requests/day** ✅

**Within free tier limits!**

## Advantages Over Deno Deploy

1. ✅ **Region visibility** - `cfColo` tells you actual location
2. ✅ **More edge locations** - 300+ vs Deno's ~30
3. ✅ **Better documentation** - More resources online
4. ✅ **Free tier** - Same as Deno Deploy

## What Happens Next

Once you set the environment variables:
1. Your server will automatically detect `CF_WORKER_*` variables
2. It will call all 4 workers during refresh
3. Each worker measures latency from its edge location
4. Results stored in `latencyByRegion` field
5. Users see accurate latency for their region

**No code changes needed** - it's already integrated! 🎉

