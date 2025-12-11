# Deploy Deno Deploy Endpoints - RIGHT NOW

## What You Need

You're deploying **4 API endpoints** (not websites). Each endpoint measures latency from a different region.

## Method 1: CLI (FASTEST - 2 minutes)

### Install Deno (one time)
```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Login (one time)
```bash
deno deploy login
```

### Deploy All 4 Regions
```bash
# Run this script - it deploys everything
./deploy-deno.sh
```

**OR** deploy manually:

```bash
deno deploy --project=latency-us-east --env=REGION=us-east deno-deploy-latency.ts
deno deploy --project=latency-eu-west --env=REGION=eu-west deno-deploy-latency.ts
deno deploy --project=latency-asia-east --env=REGION=asia-east deno-deploy-latency.ts
deno deploy --project=latency-africa-west --env=REGION=africa-west deno-deploy-latency.ts
```

After each deploy, you'll see:
```
✅ Successfully deployed to https://latency-us-east-xxxxx.deno.dev
```

**Copy those 4 URLs!**

---

## Method 2: Web Interface

### Step 1: Go to deno.com/deploy
Sign in with GitHub.

### Step 2: Click "Create" or "New Project"
Look for **"Playground"** option (NOT GitHub or URL).

### Step 3: Paste Code
1. Open `deno-deploy-latency.ts` in your editor
2. Copy **ALL** the code (Ctrl+A, Ctrl+C)
3. Paste into Deno Deploy playground
4. Delete any default code first

### Step 4: Configure
- **Project Name:** `latency-us-east`
- **Environment Variables:** Click "Add Variable"
  - Key: `REGION`
  - Value: `us-east`

### Step 5: Deploy
Click **"Deploy"** button. Wait ~30 seconds.

### Step 6: Copy URL
You'll get: `https://latency-us-east-xxxxx.deno.dev`

### Step 7: Repeat
Do steps 2-6 for:
- `latency-eu-west` (REGION=eu-west)
- `latency-asia-east` (REGION=asia-east)
- `latency-africa-west` (REGION=africa-west)

---

## After Deployment: Set Environment Variables

Add these to your **Render** or **Vercel** environment:

```env
DENO_DEPLOY_US_EAST=https://latency-us-east-xxxxx.deno.dev
DENO_DEPLOY_EU_WEST=https://latency-eu-west-xxxxx.deno.dev
DENO_DEPLOY_ASIA_EAST=https://latency-asia-east-xxxxx.deno.dev
DENO_DEPLOY_AFRICA_WEST=https://latency-africa-west-xxxxx.deno.dev
```

**That's it!** The system will automatically use these endpoints.

---

## Test Your Deployment

```bash
curl -X POST https://latency-us-east-xxxxx.deno.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

Expected response:
```json
{
  "success": true,
  "region": "us-east",
  "latencies": {
    "173.212.203.145": 443
  }
}
```

If you see this, it works! ✅

---

## What Happens Next?

Once you set the environment variables:
1. Your server calls these endpoints during refresh
2. Each endpoint measures latency from its region
3. Results are stored in `latencyByRegion` field
4. Users see accurate latency for their region

**No code changes needed** - it's already integrated!

---

## Still Confused?

**Just use CLI:**
```bash
./deploy-deno.sh
```

Copy the 4 URLs, set environment variables, done! 🎉

