# Multi-Region Latency Measurement Setup

This document explains how to set up multi-region latency measurement using various providers.

## Overview

Instead of measuring latency only from the server's location, we can measure from multiple geographic regions. The system is **provider-agnostic** - you can use any of the options below.

## Architecture

The system expects HTTP endpoints that:
1. Accept POST requests to `/measure-batch` with JSON body: `{ targets: ['1.2.3.4', ...], proxyEndpoint: 'https://rpc1.pchednode.com/rpc' }`
2. Return JSON: `{ latencies: { '1.2.3.4': 50, '5.6.7.8': 120, ... } }`

## Options

### Option 1: Cloudflare Workers (Free Tier)
**Pros:** Free, global edge network, fast
**Cons:** 100k requests/day limit (we use ~11k/day, so plenty of headroom)

**Setup:**
1. Deploy `cloudflare-worker-latency.js` to Cloudflare Workers
2. Deploy to 4-8 regions (US East, EU West, Asia East, Africa West, etc.)
3. Set environment variables:
   ```env
   CF_WORKER_US_EAST=https://your-worker-us-east.workers.dev
   CF_WORKER_EU_WEST=https://your-worker-eu-west.workers.dev
   # ... etc
   ```

### Option 2: Vercel Edge Functions
**Pros:** Free tier, similar to Cloudflare, integrates with Vercel
**Cons:** Requires Vercel deployment

**Setup:**
1. Create Vercel Edge Functions in different regions
2. Use the same API format as Cloudflare Workers
3. Set environment variables:
   ```env
   EDGE_FUNCTION_US_EAST=https://your-app.vercel.app/api/latency-us-east
   EDGE_FUNCTION_EU_WEST=https://your-app.vercel.app/api/latency-eu-west
   # ... etc
   ```

### Option 3: Self-Hosted VPS (Cheapest)
**Pros:** Full control, no limits, ~$5-10/month per region
**Cons:** Need to manage servers

**Setup:**
1. Deploy lightweight Node.js script to VPS in each region:
   ```bash
   # Install Node.js on VPS
   npm install express
   # Run the measurement server
   node measurement-server.js
   ```
2. Use the provided `measurement-server.js` script
3. Set environment variables:
   ```env
   VPS_US_EAST=http://your-vps-us-east:3000
   VPS_EU_WEST=http://your-vps-eu-west:3000
   # ... etc
   ```

### Option 4: AWS Lambda@Edge
**Pros:** Powerful, integrates with AWS
**Cons:** More complex setup, costs money

**Setup:**
1. Deploy Lambda functions to CloudFront edge locations
2. Use same API format
3. Set environment variables with Lambda URLs

### Option 5: Fly.io / Railway
**Pros:** Easy deployment, global regions
**Cons:** May have costs

**Setup:**
1. Deploy measurement endpoints to Fly.io/Railway in different regions
2. Use same API format
3. Set environment variables

## Environment Variables

The system uses a flexible naming scheme. You can mix and match providers:

```env
# Cloudflare Workers
CF_WORKER_US_EAST=https://...
CF_WORKER_EU_WEST=https://...

# Or VPS endpoints
VPS_US_EAST=http://...
VPS_EU_WEST=http://...

# Or Vercel Edge Functions
EDGE_FUNCTION_US_EAST=https://...

# Or any custom prefix
LATENCY_US_EAST=https://...
LATENCY_EU_WEST=https://...
```

The system automatically detects any environment variable matching:
- `*_US_EAST`
- `*_US_WEST`
- `*_EU_WEST`
- `*_EU_NORTH`
- `*_ASIA_EAST`
- `*_ASIA_NORTH`
- `*_AFRICA_SOUTH`
- `*_AFRICA_WEST`

## Measurement Server Script

If using self-hosted VPS, use this simple Node.js script:

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/measure-batch', async (req, res) => {
  const { targets, proxyEndpoint } = req.body;
  const proxy = proxyEndpoint || 'https://rpc1.pchednode.com/rpc';
  
  // Measure latency to proxy (same for all nodes)
  const startTime = Date.now();
  try {
    await fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'get-version', id: 1, params: [] }),
      signal: AbortSignal.timeout(2000),
    });
    const latency = Date.now() - startTime;
    
    // Return same latency for all targets
    const latencies = {};
    for (const target of targets) {
      latencies[target] = latency;
    }
    
    res.json({ success: true, latencies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => console.log('Measurement server running on port 3000'));
```

## Recommendation

**For most users:** Start with **Cloudflare Workers** (free tier is sufficient)
- Easy setup
- Free
- Well within limits (11k requests/day vs 100k limit)

**For high-volume:** Use **self-hosted VPS** ($5-10/month per region)
- No limits
- Full control
- More reliable

**For Vercel users:** Use **Vercel Edge Functions**
- Integrates seamlessly
- Free tier available
