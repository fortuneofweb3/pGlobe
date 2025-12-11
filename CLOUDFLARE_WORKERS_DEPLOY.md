# Cloudflare Workers - Quick Deploy

## Prerequisites

- Cloudflare account (free)
- 5 minutes

## Deploy All 4 Workers

### Method 1: Web Interface (Easiest)

1. **Go to:** [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**

2. **For each region** (repeat 4 times):

   **US East:**
   - Create Worker: `latency-us-east`
   - Paste code from `cloudflare-worker-latency.js`
   - Settings → Variables → Add `REGION=us-east`
   - Copy URL: `https://latency-us-east.YOUR_SUBDOMAIN.workers.dev`

   **EU West:**
   - Create Worker: `latency-eu-west`
   - Paste same code
   - Settings → Variables → Add `REGION=eu-west`
   - Copy URL

   **Asia East:**
   - Create Worker: `latency-asia-east`
   - Paste same code
   - Settings → Variables → Add `REGION=asia-east`
   - Copy URL

   **Africa West:**
   - Create Worker: `latency-africa-west`
   - Paste same code
   - Settings → Variables → Add `REGION=africa-west`
   - Copy URL

### Method 2: Wrangler CLI (Faster)

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy each worker
wrangler deploy --name latency-us-east --env REGION=us-east cloudflare-worker-latency.js
wrangler deploy --name latency-eu-west --env REGION=eu-west cloudflare-worker-latency.js
wrangler deploy --name latency-asia-east --env REGION=asia-east cloudflare-worker-latency.js
wrangler deploy --name latency-africa-west --env REGION=africa-west cloudflare-worker-latency.js
```

## Set Environment Variables

Add to **Render** and **Vercel**:

```env
CF_WORKER_US_EAST=https://latency-us-east.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_EU_WEST=https://latency-eu-west.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_ASIA_EAST=https://latency-asia-east.YOUR_SUBDOMAIN.workers.dev
CF_WORKER_AFRICA_WEST=https://latency-africa-west.YOUR_SUBDOMAIN.workers.dev
```

## Test

```bash
curl -X POST https://latency-us-east.YOUR_SUBDOMAIN.workers.dev/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

Check `cfColo` in response to see actual region!

## Done! ✅

The system will automatically use these endpoints.

