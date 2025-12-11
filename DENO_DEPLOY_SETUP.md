# Deno Deploy Setup Guide

## Why Deno Deploy?

✅ **Unlimited requests** - Perfect for per-node measurement  
✅ **Free tier is generous** - 100,000 CPU-ms/day per project  
✅ **Global edge network** - Low latency worldwide  
✅ **Easy deployment** - Simple setup process  

## Quick Setup (5 minutes)

### Step 1: Create Deno Deploy Account

1. Go to [deno.com/deploy](https://deno.com/deploy)
2. Sign up with GitHub (free)
3. Create a new project

### Step 2: Deploy to Each Region

For each region, create a separate project:

**US East:**
1. Create project: `latency-us-east`
2. Copy `deno-deploy-latency.ts` content
3. Set environment variable: `REGION=us-east`
4. Deploy

**EU West:**
1. Create project: `latency-eu-west`
2. Copy `deno-deploy-latency.ts` content
3. Set environment variable: `REGION=eu-west`
4. Deploy

**Asia East:**
1. Create project: `latency-asia-east`
2. Copy `deno-deploy-latency.ts` content
3. Set environment variable: `REGION=asia-east`
4. Deploy

**Africa West:**
1. Create project: `latency-africa-west`
2. Copy `deno-deploy-latency.ts` content
3. Set environment variable: `REGION=africa-west`
4. Deploy

### Step 3: Get Deployment URLs

After deployment, Deno Deploy gives you URLs like:
- `https://latency-us-east-xxxxx.deno.dev`
- `https://latency-eu-west-xxxxx.deno.dev`
- etc.

### Step 4: Set Environment Variables

Add to your Render/Vercel environment:

```env
DENO_DEPLOY_US_EAST=https://latency-us-east-xxxxx.deno.dev
DENO_DEPLOY_EU_WEST=https://latency-eu-west-xxxxx.deno.dev
DENO_DEPLOY_ASIA_EAST=https://latency-asia-east-xxxxx.deno.dev
DENO_DEPLOY_AFRICA_WEST=https://latency-africa-west-xxxxx.deno.dev
```

That's it! The system automatically detects and uses these endpoints.

## Deployment Steps (Detailed)

### For Each Region:

1. **Create New Project**
   - Click "New Project"
   - Name: `latency-us-east` (or region name)
   - Runtime: Deno Deploy

2. **Add Code**
   - Click "Edit Code"
   - Paste content from `deno-deploy-latency.ts`
   - Save

3. **Set Environment Variable**
   - Go to Settings → Environment Variables
   - Add: `REGION=us-east` (or appropriate region)

4. **Deploy**
   - Click "Deploy"
   - Copy the deployment URL

5. **Repeat for Other Regions**

## Testing

Test your deployment:

```bash
curl -X POST https://your-deployment.deno.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["1.2.3.4", "5.6.7.8"],
    "proxyEndpoint": "https://rpc1.pchednode.com/rpc"
  }'
```

Expected response:
```json
{
  "success": true,
  "region": "us-east",
  "proxyEndpoint": "https://rpc1.pchednode.com/rpc",
  "latencies": {
    "1.2.3.4": 50,
    "5.6.7.8": 52
  },
  "timestamp": 1234567890
}
```

## Usage Estimate

**Your Setup:**
- 159 nodes
- 4 regions
- Refresh every 10 minutes (or 1 minute)

**Requests:**
- Per refresh: 4 requests (one per region)
- Per day (10 min): 4 × (60/10) × 24 = **576 requests/day** ✅
- Per day (1 min): 4 × 60 × 24 = **5,760 requests/day** ✅

**CPU Time:**
- ~10ms per request
- Per day (1 min): 5,760 × 10ms = **57,600ms/day** ✅ (within 100k limit)

**Result:** Well within Deno Deploy free tier! ✅

## Advantages Over Cloudflare Workers

1. **Unlimited requests** - No daily limit
2. **Better for per-node** - Can measure all nodes individually
3. **More flexible** - Can measure every minute if needed
4. **Same performance** - Global edge network

## Troubleshooting

**Deployment fails:**
- Check code syntax (Deno uses TypeScript)
- Ensure `Deno.serve` is used correctly

**CORS errors:**
- Already handled in code
- Check browser console for details

**Timeout errors:**
- Increase timeout in `measureLatency` function
- Check proxy endpoint availability

## Next Steps

1. Deploy to 4 regions (US East, EU West, Asia East, Africa West)
2. Set environment variables
3. Test with curl
4. Monitor in Deno Deploy dashboard

The system will automatically start using Deno Deploy endpoints once configured!

