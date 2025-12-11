# Deno Deploy Step-by-Step Guide

## What You're Deploying

You're deploying an **Edge Function** (API endpoint), NOT a website. Deno Deploy supports both, but we need the edge function/API option.

## Step-by-Step Instructions

### Step 1: Create Deno Deploy Account

1. Go to [deno.com/deploy](https://deno.com/deploy)
2. Click "Sign Up" → Sign in with GitHub
3. You'll see the dashboard

### Step 2: Create a New Project (Edge Function)

1. Click **"New Project"** button (top right)
2. You'll see options:
   - **"Deploy from GitHub"** (if you want to connect a repo)
   - **"Deploy from URL"** (deploy from a public URL)
   - **"Deploy from CLI"** (using Deno CLI)
   - **"Playground"** (paste code directly) ← **USE THIS**

3. Click **"Playground"** (or "Create" → "Playground")

### Step 3: Paste Your Code

1. You'll see a code editor
2. **Delete** any default code
3. **Copy** the entire contents of `deno-deploy-latency.ts`
4. **Paste** it into the editor

### Step 4: Configure Project

1. **Project Name:** `latency-us-east` (or your region name)
2. **Region:** Select region (US East, EU West, etc.) if available
3. **Environment Variables:** Click "Add Variable"
   - Key: `REGION`
   - Value: `us-east` (or your region)

### Step 5: Deploy

1. Click **"Deploy"** button
2. Wait for deployment (usually 10-30 seconds)
3. You'll get a URL like: `https://latency-us-east-xxxxx.deno.dev`

### Step 6: Test Your Deployment

Test the endpoint:

```bash
curl -X POST https://your-deployment.deno.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["173.212.203.145", "173.212.220.65"],
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
    "173.212.203.145": 443,
    "173.212.220.65": 403
  },
  "timestamp": 1234567890
}
```

### Step 7: Repeat for Other Regions

1. Create **new project** for each region:
   - `latency-us-east`
   - `latency-eu-west`
   - `latency-asia-east`
   - `latency-africa-west`

2. Use **same code** (`deno-deploy-latency.ts`)
3. Change **environment variable** `REGION` for each:
   - `us-east`
   - `eu-west`
   - `asia-east`
   - `africa-west`

### Step 8: Get Deployment URLs

After deploying all 4 regions, you'll have URLs like:
- `https://latency-us-east-xxxxx.deno.dev`
- `https://latency-eu-west-xxxxx.deno.dev`
- `https://latency-asia-east-xxxxx.deno.dev`
- `https://latency-africa-west-xxxxx.deno.dev`

### Step 9: Set Environment Variables

Add to your Render/Vercel environment:

```env
DENO_DEPLOY_US_EAST=https://latency-us-east-xxxxx.deno.dev
DENO_DEPLOY_EU_WEST=https://latency-eu-west-xxxxx.deno.dev
DENO_DEPLOY_ASIA_EAST=https://latency-asia-east-xxxxx.deno.dev
DENO_DEPLOY_AFRICA_WEST=https://latency-africa-west-xxxxx.deno.dev
```

## Alternative: Deploy via CLI

If the web interface is confusing, use CLI:

### Install Deno CLI

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Or via Homebrew
brew install deno
```

### Deploy

```bash
# Login
deno deploy login

# Deploy
deno deploy --project=latency-us-east --env=REGION=us-east deno-deploy-latency.ts
```

## Troubleshooting

**"I only see website deployment options"**
- Look for "Playground" or "Create" → "Playground"
- Or use CLI method above

**"How do I know it's an edge function?"**
- Edge functions respond to HTTP requests
- They don't serve HTML/static files
- They're API endpoints

**"Can I test it in browser?"**
- Yes! Go to: `https://your-deployment.deno.dev/measure-batch`
- You'll see an error (needs POST), but it confirms it's deployed

## Quick Test Script

Create `test-deno-deploy.sh`:

```bash
#!/bin/bash
ENDPOINT="https://your-deployment.deno.dev/measure-batch"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["173.212.203.145"],
    "proxyEndpoint": "https://rpc1.pchednode.com/rpc"
  }'
```

Run: `chmod +x test-deno-deploy.sh && ./test-deno-deploy.sh`

## What You're Building

You're creating **4 API endpoints** (one per region) that:
- Accept POST requests to `/measure-batch`
- Measure latency to nodes
- Return JSON with latency data

These are **not websites** - they're **API endpoints** (like a backend service).

