# How to Deploy Merge Strategy to Render

## Current Status

✅ Code pushed to GitHub (commit `aedc0b6`)
⏳ Waiting for Render to deploy

## Option 1: Auto-Deploy (Recommended)

If Render is connected to your GitHub repo with auto-deploy enabled, it should deploy automatically within 5-10 minutes.

**Check deployment status:**
1. Go to: https://dashboard.render.com
2. Find service: `pglobe-api-server`
3. Check if there's a deployment in progress for commit `aedc0b6`

## Option 2: Manual Deploy (Fast)

If auto-deploy isn't enabled or you want it deployed now:

1. Go to: https://dashboard.render.com
2. Select service: `pglobe-api-server`
3. Click **"Manual Deploy"**
4. Select **"Deploy latest commit"**
5. Wait ~2-3 minutes for build to complete

## Option 3: API Deploy (Command Line)

If you have your Render API key:

```bash
export RENDER_API_KEY='your-key-here'
export RENDER_SERVICE_ID='srv-xxxxx'
bash scripts/trigger-render-deploy.sh
```

Get your API key from: https://dashboard.render.com/u/settings#api-keys

## After Deployment

Once deployed, the merge strategy will automatically activate:

1. **Within 1 minute**: Next background refresh will run with new code
2. **Check it's working**: Run this script:
   ```bash
   MONGODB_URI="$(grep MONGODB_URI .env.local | cut -d'=' -f2- | tr -d "'")" node scripts/check-new-nodes.js
   ```
3. **Look for**: "Nodes with previousAddresses: X" (should be > 0)

## What Will Happen

- Node count: Will stay at 191 (same unique nodes)
- Data quality: All IP addresses will be tracked
- IP history: Nodes with multiple IPs will have `previousAddresses` populated

## Troubleshooting

### "No nodes with previousAddresses yet"
- Merge strategy hasn't run yet
- Wait 1 minute after deployment
- Re-run check script

### "Deployment failed"
- Check Render dashboard for error logs
- May need to rebuild dependencies
- Try "Clear build cache & deploy"

### "Auto-deploy not working"
- Check Render → Service Settings → "Auto-Deploy"
- Make sure it's set to "Yes" for branch "main"

