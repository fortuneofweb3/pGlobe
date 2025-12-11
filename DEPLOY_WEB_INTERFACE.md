# Deploy via Deno Deploy Web Interface (EASIEST)

The CLI has some complexity, so let's use the web interface instead. It's actually faster!

## Step-by-Step

### 1. Go to Deno Deploy Dashboard
Visit: https://dash.deno.com/projects

### 2. Click "New Project" or "Create"

### 3. Select "Playground" (NOT GitHub or URL)

You'll see a code editor.

### 4. Copy the Code
1. Open `deno-deploy-latency.ts` in your editor
2. Select ALL the code (Ctrl+A / Cmd+A)
3. Copy it (Ctrl+C / Cmd+C)
4. Paste into Deno Deploy playground (delete any default code first)

### 5. Configure Project
- **Project Name:** `latency-us-east`
- Click **"Environment Variables"** → **"Add Variable"**
  - Key: `REGION`
  - Value: `us-east`

### 6. Deploy
Click **"Deploy"** button (top right)

Wait ~30 seconds, then you'll see:
- ✅ Deployment successful
- URL: `https://latency-us-east-xxxxx.deno.dev`

### 7. Copy the URL
Copy the deployment URL shown.

### 8. Repeat for Other Regions
Do steps 2-7 for:
- `latency-eu-west` (REGION=eu-west)
- `latency-asia-east` (REGION=asia-east)  
- `latency-africa-west` (REGION=africa-west)

### 9. Set Environment Variables
Add these to your **Render** or **Vercel**:

```env
DENO_DEPLOY_US_EAST=https://latency-us-east-xxxxx.deno.dev
DENO_DEPLOY_EU_WEST=https://latency-eu-west-xxxxx.deno.dev
DENO_DEPLOY_ASIA_EAST=https://latency-asia-east-xxxxx.deno.dev
DENO_DEPLOY_AFRICA_WEST=https://latency-africa-west-xxxxx.deno.dev
```

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

## That's It!

The web interface is actually easier than CLI for this use case. Takes about 5 minutes total for all 4 regions.

