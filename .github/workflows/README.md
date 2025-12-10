# GitHub Actions Workflows

This repository uses GitHub Actions for two automated tasks:

1. **Background Refresh** - Refreshes node data every minute
2. **Keep Render Alive** - Pings Render service every 10 minutes to prevent spin-down

## Background Refresh Workflow

This workflow automatically refreshes your node data every minute using GitHub Actions (completely free).

## Setup Instructions

### 1. Get Your Vercel Deployment URL

1. Go to your Vercel dashboard
2. Select your project
3. Copy your deployment URL (e.g., `https://pglobe.vercel.app`)

### 2. Set Up GitHub Secrets

**Step-by-step:**

1. Go to your GitHub repository: `https://github.com/fortuneofweb3/pGlobe` (or your repo URL)
2. Click on the **Settings** tab (top menu, next to "Insights")
3. In the left sidebar, scroll down and click **Secrets and variables**
4. Click **Actions** (should be selected by default)
5. Click the green **New repository secret** button

**Add these secrets one by one:**

#### Required:
- **Name**: `VERCEL_URL`
- **Value**: Your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
- **Important**: No trailing slash!

#### Recommended (for security):
- **Name**: `CRON_SECRET`
- **Value**: Generate a secret (see below)

### 3. Generate CRON_SECRET

Run this command to generate a secure random secret:

```bash
openssl rand -hex 32
```

Or use an online generator: https://www.random.org/strings/

**Then add the same secret to Vercel:**
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add variable:
   - **Name**: `CRON_SECRET`
   - **Value**: (paste the same secret you used in GitHub)
   - **Environment**: Production, Preview, Development

### 4. Verify It's Working

1. Go to your GitHub repository
2. Click on **Actions** tab
3. You should see "Refresh Nodes Background Task" workflow
4. Click on it to see runs (should run every minute)
5. Check the logs to verify it's calling your Vercel endpoint successfully

### 5. Manual Trigger (Optional)

You can manually trigger the refresh:
1. Go to **Actions** → **Refresh Nodes Background Task**
2. Click **Run workflow** button
3. Select branch and click **Run workflow**

## Monitoring

- **GitHub Actions**: Check the Actions tab for workflow runs
- **Vercel Logs**: Check Vercel dashboard → Your Project → Logs
- Look for `[Cron] Starting background refresh...` messages

## Troubleshooting

### Workflow not running
- Check that the workflow file is in `.github/workflows/` directory
- Verify the cron syntax is correct
- GitHub Actions might have slight delays (up to a few minutes)

### 401 Unauthorized
- Verify `CRON_SECRET` matches in both GitHub and Vercel
- Check that the secret is set in the correct environment

### Connection failed
- Verify `VERCEL_URL` is correct (no trailing slash)
- Check that your Vercel deployment is live
- Ensure the URL is accessible

### Timeout errors
- The refresh might take longer than expected
- Consider increasing the interval to every 2-5 minutes instead of every minute
- Check Vercel function logs for performance issues

## Cost

**GitHub Actions**: Completely free for public repositories
- 2,000 minutes/month free for private repos
- Unlimited for public repos
- Each run uses ~1-2 seconds, so you can run every minute easily

## Alternative: Change Schedule

If you want to run less frequently, edit `.github/workflows/refresh-nodes.yml`:

```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
  - cron: '*/10 * * * *' # Every 10 minutes
  - cron: '0 * * * *'    # Every hour
```

