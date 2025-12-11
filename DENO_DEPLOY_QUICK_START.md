# Deno Deploy Quick Start (Simplest Method)

## Option 1: Web Interface (Easiest)

### Step 1: Go to Deno Deploy
1. Visit [deno.com/deploy](https://deno.com/deploy)
2. Sign in with GitHub

### Step 2: Create Project
1. Click **"Create"** or **"New Project"**
2. Select **"Playground"** (not "GitHub" or "URL")
3. This opens a code editor

### Step 3: Paste Code
1. Open `deno-deploy-latency.ts` in your editor
2. Copy **ALL** the code
3. Paste into Deno Deploy playground
4. Delete any default code first

### Step 4: Configure
1. **Project Name:** `latency-us-east`
2. Click **"Environment Variables"**
3. Add: `REGION` = `us-east`

### Step 5: Deploy
1. Click **"Deploy"** button
2. Wait ~30 seconds
3. Copy the URL (e.g., `https://latency-us-east-xxxxx.deno.dev`)

### Step 6: Repeat
Do steps 2-5 for each region:
- `latency-eu-west` (REGION=eu-west)
- `latency-asia-east` (REGION=asia-east)
- `latency-africa-west` (REGION=africa-west)

---

## Option 2: CLI (Faster)

### Install Deno
```bash
curl -fsSL https://deno.land/install.sh | sh
# Or: brew install deno
```

### Deploy
```bash
# Login once
deno deploy login

# Deploy all regions
./deploy-deno.sh
```

That's it! The script deploys to all 4 regions automatically.

---

## Verify It Works

Test your deployment:

```bash
curl -X POST https://latency-us-east-xxxxx.deno.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

You should get JSON back with latency data.

---

## Still Confused?

**What you're creating:**
- 4 API endpoints (not websites)
- They respond to HTTP POST requests
- They measure latency and return JSON

**Think of it like:**
- Creating 4 backend API servers
- Each in a different region
- They all run the same code
- They measure latency from their region

**The code (`deno-deploy-latency.ts`):**
- Is a serverless function
- Runs on Deno Deploy's edge network
- Responds to HTTP requests
- Returns JSON data

Need help? The CLI method (`./deploy-deno.sh`) is easiest - just run it!

