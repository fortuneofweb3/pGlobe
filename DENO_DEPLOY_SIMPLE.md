# Deno Deploy - Simple Guide

## The Confusion

Deno Deploy **does** look like a website platform, but it also runs **API endpoints** (edge functions). You're deploying an API, not a website.

## Easiest Method: Use CLI (Recommended)

### Step 1: Install Deno

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Or with Homebrew
brew install deno

# Verify
deno --version
```

### Step 2: Login to Deno Deploy

```bash
deno deploy login
```

This opens your browser. Sign in with GitHub.

### Step 3: Deploy (One Command Per Region)

```bash
# Deploy to US East
deno deploy --project=latency-us-east --env=REGION=us-east deno-deploy-latency.ts

# Deploy to EU West
deno deploy --project=latency-eu-west --env=REGION=eu-west deno-deploy-latency.ts

# Deploy to Asia East
deno deploy --project=latency-asia-east --env=REGION=asia-east deno-deploy-latency.ts

# Deploy to Africa West
deno deploy --project=latency-africa-west --env=REGION=africa-west deno-deploy-latency.ts
```

**OR** use the script:

```bash
./deploy-deno.sh
```

### Step 4: Get Your URLs

After each deploy, you'll see:
```
✅ Successfully deployed to https://latency-us-east-xxxxx.deno.dev
```

Copy those URLs!

---

## Alternative: Web Interface

If you prefer the web interface:

### Step 1: Go to deno.com/deploy

### Step 2: Look for "Playground" or "Create" → "Playground"

**NOT** "Deploy from GitHub" or "Deploy from URL"

### Step 3: In the Playground

1. **Delete** any default code
2. **Copy** entire `deno-deploy-latency.ts` file
3. **Paste** into editor
4. **Project Name:** `latency-us-east`
5. **Environment Variables:** Add `REGION=us-east`
6. **Click "Deploy"**

### Step 4: Copy the URL

You'll get: `https://latency-us-east-xxxxx.deno.dev`

---

## What You're Creating

You're creating **4 API endpoints** that:
- Accept POST requests
- Measure latency
- Return JSON

**NOT websites** - they're **backend APIs**.

---

## Test It

```bash
curl -X POST https://latency-us-east-xxxxx.deno.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

If you get JSON back, it works! ✅

---

## Still Confused?

**Use the CLI method** - it's clearer:
1. `deno deploy login` (once)
2. `./deploy-deno.sh` (deploys all 4 regions)

That's it!

