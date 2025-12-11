# Deno Deploy Endpoints - Ready to Use! ✅

## Your Deployment URLs

All 4 regions are deployed and ready:

- **US East:** https://us-east.fortuneofweb3.deno.net
- **EU West:** https://eu-west.fortuneofweb3.deno.net
- **Asia East:** https://asia-east.fortuneofweb3.deno.net
- **Africa West:** https://africa-west.fortuneofweb3.deno.net

## Environment Variables to Set

Add these to your **Render** and **Vercel** environment variables:

```env
DENO_DEPLOY_US_EAST=https://us-east.fortuneofweb3.deno.net
DENO_DEPLOY_EU_WEST=https://eu-west.fortuneofweb3.deno.net
DENO_DEPLOY_ASIA_EAST=https://asia-east.fortuneofweb3.deno.net
DENO_DEPLOY_AFRICA_WEST=https://africa-west.fortuneofweb3.deno.net
```

## Test Endpoints

Test each endpoint:

```bash
# US East
curl -X POST https://us-east.fortuneofweb3.deno.net/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'

# EU West
curl -X POST https://eu-west.fortuneofweb3.deno.net/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'

# Asia East
curl -X POST https://asia-east.fortuneofweb3.deno.net/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'

# Africa West
curl -X POST https://africa-west.fortuneofweb3.deno.net/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

Expected response:
```json
{
  "success": true,
  "region": "us-east",
  "proxyEndpoint": "https://rpc1.pchednode.com/rpc",
  "latencies": {
    "173.212.203.145": 443
  },
  "timestamp": 1234567890
}
```

## What Happens Next

Once you set the environment variables:

1. ✅ Your server will automatically detect them
2. ✅ During each refresh, it will call all 4 endpoints
3. ✅ Each endpoint measures latency from its region
4. ✅ Results are stored in `latencyByRegion` field
5. ✅ Users see accurate latency for their selected region

**No code changes needed** - it's already integrated! 🎉

## Verify It's Working

After setting environment variables, check your server logs during a refresh. You should see:

```
[MultiRegionLatency] Measured 159 node latencies from 4/4 regions
```

This confirms the multi-region latency measurement is working!

