# Render + Vercel Setup Guide

This guide shows you how to run all backend operations on Render while keeping your frontend on Vercel.

## Architecture

- **Vercel**: Frontend + API proxy endpoints (proxies to Render, no direct DB/pRPC access)
- **Render**: 
  - **API Server**: Single service that handles:
    - Background refresh (instrumentation) - runs every minute
    - pRPC fetching + MongoDB writes
    - API endpoints for Vercel to call
- **MongoDB**: Shared database (only Render connects to it)

## Step 1: Set Up Render API Server

### 1.1 Create Render Account

1. Go to https://render.com
2. Sign up (free tier available)
3. Connect your GitHub repository

### 1.2 Create API Server

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your repository
3. Configure:

   **Basic Settings:**
   - **Name**: `pglobe-api-server`
   - **Region**: Choose closest to your MongoDB
   - **Branch**: `main`
   - **Root Directory**: Leave empty

   **Build & Deploy:**
   - **Build Command**: `npm install --include=dev`
   - **Start Command**: `npx tsx render-api-server.ts`
   - **Environment**: `Node`

   **Environment Variables:**
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = (your MongoDB connection string)
   - `API_SECRET` = (generate with `openssl rand -hex 32` - **save this!**)
   - `PORT` = `3001` (or let Render auto-assign)
   
   **Note**: pRPC endpoints are configured in `lib/server/network-config.ts`. The system automatically uses all enabled networks (currently devnet1 and devnet2) for redundancy.

4. Click **"Create Web Service"**
5. **Copy the service URL** (e.g., `https://pglobe-api-server.onrender.com`) - you'll need this for Vercel

### 1.3 Verify Server Is Running

**API Server Logs should show:**
```
[RenderAPI] Starting server...
[RenderAPI] Creating MongoDB indexes...
[RenderAPI] ✅ MongoDB indexes created
[RenderAPI] Starting background refresh task...
[RenderAPI] ✅ Background refresh started (runs every 1 minute)
[RenderAPI] 🚀 API server running on port 3001
[RenderAPI] Background refresh active - data updates every minute
```

Wait 1-2 minutes, then check logs for:
```
[BackgroundRefresh] Starting refresh...
[BackgroundRefresh] Fetched X nodes from gossip
[BackgroundRefresh] ✅ Updated X nodes in MongoDB
```

---

## Step 2: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add/Update:
   - `RENDER_API_URL` = (your Render API server URL, e.g., `https://pglobe-api-server.onrender.com`)
   - `API_SECRET` = (same secret you used in Render API server)
   - **Optional**: Remove `MONGODB_URI` from Vercel (no longer needed, but keeping it won't hurt)

3. **Redeploy** your Vercel app to pick up the new env vars

---

## Step 3: Verify Everything Works

### Check Render Logs

**API Server** should show:
1. Background refresh running every minute:
```
[BackgroundRefresh] Starting refresh...
[BackgroundRefresh] Fetched 120 nodes from gossip
[BackgroundRefresh] ✅ Updated 120 nodes in MongoDB
```

2. API requests being handled:
```
[RenderAPI] Refresh request received
[RenderAPI] ✅ Refresh completed
```

### Check Vercel Logs

Should see proxy requests:
```
[VercelProxy] Proxying refresh request to Render...
[VercelProxy] ✅ Refresh completed via Render
```

### Test Your App

1. Visit your Vercel app
2. Node data should load (from Render API)
3. Data should update automatically (background worker refreshes every minute)

---

## Step 4: Monitor & Troubleshoot

### API Server Not Starting

**Check:**
- Environment variables are set correctly
- `MONGODB_URI` is valid
- Build command is `npm install --include=dev` (needed for `tsx` and `tailwindcss`)
- Start command is `npx tsx render-api-server.ts`

**Logs to look for:**
```
[RenderAPI] ❌ Failed to start server: [error]
```

### API Server Not Responding

**Check:**
- Service is running (not sleeping on free tier)
- `API_SECRET` matches between Render and Vercel
- `RENDER_API_URL` is correct in Vercel

**Test manually:**
```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  https://your-api-server.onrender.com/health
```

### Vercel Proxy Failing

**Check:**
- `RENDER_API_URL` is set correctly
- `API_SECRET` matches Render
- Render API server is accessible

**Vercel logs should show:**
```
[VercelProxy] ❌ Failed to proxy to Render: [error]
```

### Data Not Updating

1. **Check Render API server logs**: Is background refresh completing successfully?
2. **Check Render API logs**: Are requests being handled?
3. **Check MongoDB**: Are nodes actually being updated?

---

## Render Free Tier Limits

- ✅ Web services supported
- ✅ 750 hours/month free (enough for 24/7)
- ⚠️ **Free tier services sleep after 15 minutes of inactivity**
  - Web services: May sleep (wake up on first request)
  - **Note**: Background refresh will pause when service sleeps, but resumes when woken

**For production**: Consider paid tier ($7/month) for always-on API server (background refresh runs continuously)

---

## Security Notes

- **API_SECRET**: Required for Vercel to authenticate with Render API
- **MongoDB**: Only Render services connect to it (Vercel doesn't have access)
- **pRPC**: Only Render services fetch from gossip (Vercel doesn't have access)

This architecture keeps all sensitive operations on Render, away from client-side exposure.

---

## Cost Comparison

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| **Vercel** | Frontend hosting | $20/month (Pro) |
| **Render API** | 750 hrs/month (may sleep) | $7/month (always-on) |
| **MongoDB** | Atlas free tier | Varies |

**Total**: Free for development, ~$27/month for production (always-on)

---

## Benefits of This Setup

✅ **Secure**: No DB/pRPC access from Vercel (client-side safe)  
✅ **Reliable**: Background refresh runs continuously (like local instrumentation)  
✅ **No timeouts**: Render web services don't have serverless limits  
✅ **Simple**: Single service handles everything (refresh + API)  
✅ **Cost-effective**: One service instead of two  

---

## Rollback Plan

If Render doesn't work out, you can:
1. Revert Vercel routes to direct DB access
2. Re-enable cron-job.org
3. Or use GitHub Actions (already set up)

The code structure supports both architectures!
