# cron-job.org Setup Guide

Quick setup guide for using cron-job.org to automatically refresh your node data every minute.

## Step 1: Generate CRON_SECRET

Run this command to generate a secure secret:
```bash
openssl rand -hex 32
```

Or use an online generator: https://www.random.org/strings/

**Save this secret** - you'll need it in both Vercel and cron-job.org.

---

## Step 2: Add CRON_SECRET to Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Key**: `CRON_SECRET`
   - **Value**: (paste the secret you generated)
   - **Environment**: Select all (Production, Preview, Development)
6. Click **Save**

---

## Step 3: Get Your Vercel URL

1. In Vercel Dashboard → Your Project → **Deployments**
2. Copy your production URL (e.g., `https://your-project.vercel.app`)
3. **Important**: No trailing slash!

---

## Step 4: Set Up cron-job.org

1. **Sign up**: Go to https://cron-job.org/en/ and create a free account

2. **Create Cron Job**:
   - Click **"Create cronjob"** button
   - Fill in the form:

   **Basic Settings:**
   - **Title**: `pGlobe Background Refresh`
   - **Address (URL)**: `https://your-project.vercel.app/api/refresh-nodes`
     (Replace `your-project.vercel.app` with your actual Vercel URL)

   **Schedule:**
   - **Execution**: `Every minute` (or select `*/1 * * * *` in cron syntax)

   **Request Settings:**
   - **Request Method**: `GET`
   - **Request Headers**: Click **"Add Header"**
     - **Name**: `Authorization`
     - **Value**: `Bearer YOUR_CRON_SECRET`
       (Replace `YOUR_CRON_SECRET` with the secret you generated in Step 1)

   **Advanced (Optional):**
   - **Timeout**: `60` seconds (to allow enough time for the refresh)
   - **Notifications**: Enable if you want email alerts on failures

3. **Save**: Click **"Create cronjob"**

---

## Step 5: Test It

1. In cron-job.org, click on your cron job
2. Click **"Execute now"** to test it immediately
3. Check the **"Last execution"** log - should show `200 OK`
4. Check Vercel logs:
   - Go to Vercel Dashboard → Your Project → **Logs**
   - Look for `[Refresh] Starting background refresh...` messages
   - Should see `[Refresh] Trigger: External cron`

---

## Step 6: Verify It's Working

1. **Check cron-job.org logs**: Should show successful executions every minute
2. **Check Vercel logs**: Should see refresh logs every minute
3. **Check your app**: Node data should update automatically

---

## Troubleshooting

### 401 Unauthorized
- **Problem**: cron-job.org is getting rejected
- **Solution**: 
  - Double-check `CRON_SECRET` matches exactly in both Vercel and cron-job.org
  - Make sure the header value is `Bearer YOUR_SECRET` (with "Bearer " prefix and space)

### Timeout Errors
- **Problem**: Refresh takes longer than 60 seconds
- **Solution**: 
  - Increase timeout in cron-job.org to 120 seconds
  - Or change schedule to every 2-5 minutes instead of every minute

### No Logs in Vercel
- **Problem**: cron-job.org isn't calling the endpoint
- **Solution**:
  - Check cron-job.org execution logs
  - Verify the URL is correct (no trailing slash)
  - Test the URL manually in browser: `https://your-project.vercel.app/api/refresh-nodes`

### Data Not Updating
- **Problem**: Cron is running but data isn't refreshing
- **Solution**:
  - Check Vercel logs for errors
  - Verify MongoDB connection is working
  - Check that `performRefresh()` is completing successfully

---

## Free Tier Limits

cron-job.org free tier includes:
- ✅ Unlimited cron jobs
- ✅ 1-minute minimum interval
- ✅ Email notifications
- ✅ Execution history

This is perfect for your use case!

---

## Alternative: Test Without Secret (Less Secure)

If you want to test without setting up the secret first:

1. **Don't set `CRON_SECRET` in Vercel** (or remove it temporarily)
2. **Don't add Authorization header** in cron-job.org
3. The endpoint will work, but anyone can call it (less secure)

**⚠️ Not recommended for production!** Always use `CRON_SECRET` for security.

