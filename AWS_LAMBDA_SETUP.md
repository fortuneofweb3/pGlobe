# AWS Lambda Setup - True Region Control ✅

## Why AWS Lambda?

- ✅ **YOU SELECT THE REGION** when deploying
- ✅ **Serverless** (no server management)
- ✅ **Free tier**: 1M requests/month
- ✅ **Has Africa region**: `af-south-1` (Cape Town) ✅
- ✅ **True geographic control** - Code runs exactly where you deploy it

## AWS Regions Available

- `us-east-1` (N. Virginia) - **US East** ✅
- `eu-west-1` (Ireland) - **EU West** ✅
- `ap-southeast-1` (Singapore) - **Asia East** ✅
- `af-south-1` (Cape Town) - **Africa South** ✅

## Step-by-Step Setup

### Step 1: Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Sign up (free tier available)
3. Go to **Lambda** service

### Step 2: Create First Lambda (US East)

1. Click **"Create function"**
2. **Function name:** `latency-us-east`
3. **Runtime:** Node.js 20.x (or latest)
4. **Architecture:** x86_64
5. **Region:** **us-east-1 (N. Virginia)** ← **YOU SELECT THIS!**
6. Click **"Create function"**

### Step 3: Add Code

1. Scroll to **"Code source"** section
2. **Delete** all default code
3. **Copy** entire contents of `aws-lambda-latency.js`
4. **Paste** into editor
5. Click **"Deploy"**

### Step 4: Configure Function

1. Go to **"Configuration"** tab
2. **General configuration:**
   - Timeout: 30 seconds (increase from default 3s)
   - Memory: 256 MB (minimum)
3. **Environment variables:**
   - Add: `REGION=us-east` (optional, Lambda provides AWS_REGION)

### Step 5: Create API Gateway

1. Go to **"Configuration"** → **"Function URL"**
2. Click **"Create function URL"**
3. **Auth type:** NONE (public)
4. **CORS:** Enable
5. Click **"Save"**
6. Copy the **Function URL**

### Step 6: Repeat for Other Regions

Do steps 2-5 for each region:

**EU West:**
- Function name: `latency-eu-west`
- **Region:** **eu-west-1 (Ireland)** ← Select this!
- Function URL: Copy this

**Asia East:**
- Function name: `latency-asia-east`
- **Region:** **ap-southeast-1 (Singapore)** ← Select this!
- Function URL: Copy this

**Africa South:**
- Function name: `latency-africa-south`
- **Region:** **af-south-1 (Cape Town)** ← Select this!
- Function URL: Copy this

## Environment Variables to Set

After deploying all 4 Lambda functions, add these to your **Render** and **Vercel**:

```env
AWS_LAMBDA_US_EAST=https://YOUR_FUNCTION_URL_1.lambda-url.us-east-1.on.aws/
AWS_LAMBDA_EU_WEST=https://YOUR_FUNCTION_URL_2.lambda-url.eu-west-1.on.aws/
AWS_LAMBDA_ASIA_EAST=https://YOUR_FUNCTION_URL_3.lambda-url.ap-southeast-1.on.aws/
AWS_LAMBDA_AFRICA_SOUTH=https://YOUR_FUNCTION_URL_4.lambda-url.af-south-1.on.aws/
```

## Test Your Deployment

```bash
curl -X POST https://YOUR_FUNCTION_URL.lambda-url.us-east-1.on.aws/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

Expected response:
```json
{
  "success": true,
  "region": "us-east-1",
  "latencies": {
    "173.212.203.145": 43
  }
}
```

**The `region` field shows the actual AWS region!** ✅

## AWS Lambda Limits

**Free Tier:**
- ✅ 1M requests/month
- ✅ 400,000 GB-seconds compute time
- ✅ 15 minutes max execution time

**For 4 functions, 159 nodes, every 10 minutes:**
- 159 nodes × 4 regions = 636 requests per refresh
- 636 × (60/10) × 24 × 30 = **2,747,520 requests/month** ❌

**Wait, that exceeds free tier!**

**Solution:** Reduce refresh frequency or use VPS for some regions.

## Alternative: Use VPS (Cheaper for High Volume)

If you're making many requests, VPS is cheaper:
- **DigitalOcean**: $6/month per droplet
- **4 regions**: $24/month total
- **Unlimited requests** ✅

## Recommendation

**For low-medium traffic:** AWS Lambda (serverless, region-controlled)
**For high traffic:** VPS (cheaper, unlimited requests)

Would you like me to:
1. Set up AWS Lambda deployment scripts?
2. Set up VPS deployment scripts?
3. Hybrid approach (Lambda for some, VPS for others)?

