# Background Refresh Setup for Vercel Hobby Plan

Since Vercel Hobby plan doesn't support Cron Jobs, you need to use an external service to trigger the background refresh.

## ✅ Recommended: GitHub Actions (Free & Best)

**Already set up!** See `.github/workflows/refresh-nodes.yml`

Just add these GitHub Secrets:
1. `VERCEL_URL` - Your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. `CRON_SECRET` - A random secret (generate with `openssl rand -hex 32`)

Then add the same `CRON_SECRET` to Vercel environment variables.

See `.github/workflows/README.md` for detailed setup instructions.

---

## Alternative Options

### Option 1: cron-job.org (Free)

1. Go to https://cron-job.org/en/
2. Sign up for a free account
3. Create a new cron job:
   - **Title**: pGlobe Background Refresh
   - **URL**: `https://your-domain.vercel.app/api/refresh-nodes`
   - **Schedule**: Every minute (`*/1 * * * *`)
   - **Request Method**: GET
   - **Request Headers**: 
     - Key: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET` (see below)

### Option 2: EasyCron (Free tier available)

1. Go to https://www.easycron.com/
2. Sign up for free account
3. Create cron job:
   - **URL**: `https://your-domain.vercel.app/api/refresh-nodes`
   - **Schedule**: Every 1 minute
   - **HTTP Method**: GET
   - **HTTP Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: GitHub Actions (Free)

Create `.github/workflows/refresh-nodes.yml`:

```yaml
name: Refresh Nodes
on:
  schedule:
    - cron: '*/1 * * * *'  # Every minute
  workflow_dispatch:  # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Call Refresh API
        run: |
          curl -X GET "https://your-domain.vercel.app/api/cron/refresh-nodes" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Security Setup

### 1. Set CRON_SECRET in Vercel

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Generate a strong random string (e.g., use `openssl rand -hex 32`)
   - **Environment**: Production, Preview, Development

### 2. Use the Secret in Your Cron Service

When setting up your external cron service, add this header:
- **Header Name**: `Authorization`
- **Header Value**: `Bearer YOUR_CRON_SECRET_VALUE`

## Testing

You can test the endpoint manually:

```bash
# Without secret (if not set)
curl https://your-domain.vercel.app/api/refresh-nodes

# With secret
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/refresh-nodes
```

## Alternative: On-Demand Refresh

If you don't want to set up external cron, you can:

1. **Manual trigger**: Visit `/api/refresh-nodes` in browser or use curl
2. **On page load**: Add a client-side trigger (not recommended for production)
3. **Use existing `/api/sync-nodes` endpoint**: Call it manually when needed

## Monitoring

Check Vercel logs to verify the cron is running:
1. Go to Vercel Dashboard → Your Project → Logs
2. Look for `[Cron] Starting background refresh...` messages
3. Should see logs every minute if cron is working

## Troubleshooting

- **401 Unauthorized**: Check that `CRON_SECRET` matches in both Vercel and your cron service
- **No logs**: Verify the cron service is actually calling the URL
- **Timeout errors**: The refresh might take longer than 10 seconds (Vercel Hobby limit). Consider optimizing or using a longer interval (e.g., every 2-5 minutes)

