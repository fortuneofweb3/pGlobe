# Deployment Guide

This guide explains how to deploy changes to production after testing locally.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │    Render       │
│   (Frontend)    │────────▶│   (Backend)     │
│   Port: 3000    │  Proxy  │   Port: 3001   │
│   Next.js       │         │   Express API   │
└─────────────────┘         └─────────────────┘
```

**Local Development:**
- Terminal 1: Backend (`npm run dev:api`) → `http://localhost:3001`
- Terminal 2: Frontend (`npm run dev`) → `http://localhost:3000`
- Frontend proxies all API calls to backend (just like production)

**Production:**
- Vercel: Frontend → `https://pglobe.vercel.app`
- Render: Backend → `https://pglobe-api-server.onrender.com`
- Frontend proxies all API calls to Render backend

## Development Workflow

### 1. Local Testing

**Start both servers locally:**

```bash
# Terminal 1 - Backend (like Render)
npm run dev:api

# Terminal 2 - Frontend (like Vercel)
npm run dev
```

**Make your changes:**
- Edit frontend code → Test in Terminal 2
- Edit backend code → Test in Terminal 1
- Both servers hot-reload automatically

**Verify:**
- Visit `http://localhost:3000`
- Check Terminal 2 logs for `[VercelProxy]` messages
- Check Terminal 1 logs for `[RenderAPI]` messages

### 2. Deploy Changes

#### Deploy Frontend Changes (Vercel)

**What to deploy:**
- `app/` directory (pages, components)
- `components/` directory
- `lib/client/` directory
- `public/` directory
- `app/api/` routes (these proxy to backend)

**Steps:**
1. Commit your changes:
   ```bash
   git add .
   git commit -m "Update frontend: [description]"
   git push
   ```

2. Vercel automatically deploys on push (if connected to GitHub)
   - Or manually deploy via Vercel dashboard

3. Verify deployment:
   - Visit `https://pglobe.vercel.app`
   - Check Vercel logs for errors

#### Deploy Backend Changes (Render)

**What to deploy:**
- `render-api-server.ts`
- `lib/server/` directory
- `lib/types/` directory
- `lib/utils/` directory

**Steps:**
1. Commit your changes:
   ```bash
   git add .
   git commit -m "Update backend: [description]"
   git push
   ```

2. Render automatically deploys on push (if connected to GitHub)
   - Or manually deploy via Render dashboard

3. Verify deployment:
   - Check Render logs: `https://dashboard.render.com`
   - Test backend directly: `curl https://pglobe-api-server.onrender.com/health`
   - Check Vercel logs to see if proxying works

## Environment Variables

### Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

```
RENDER_API_URL=https://pglobe-api-server.onrender.com
API_SECRET=[same as Render]
```

### Render Environment Variables

Set these in Render Dashboard → Environment:

```
MONGODB_URI=[your MongoDB connection string]
API_SECRET=[generate with: openssl rand -hex 32]
PORT=3001
NODE_ENV=production
```

### Local Environment Variables

Create `.env.local`:

```
RENDER_API_URL=http://localhost:3001
API_SECRET=[any secret for local dev]
MONGODB_URI=[your MongoDB connection string]
```

## Testing Checklist

Before deploying:

- [ ] Backend starts successfully (`npm run dev:api`)
- [ ] Frontend starts successfully (`npm run dev`)
- [ ] Frontend can fetch nodes from backend
- [ ] API routes proxy correctly (check logs)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)

## Common Issues

### Frontend can't connect to backend

**Check:**
- Backend is running on port 3001
- `RENDER_API_URL=http://localhost:3001` in `.env.local`
- Backend logs show server started

**Test:**
```bash
curl http://localhost:3001/health
```

### Backend not updating data

**Check:**
- MongoDB connection string is correct
- Background refresh is running (check logs for `[BackgroundRefresh]`)
- Network config has enabled networks

### Vercel deployment fails

**Check:**
- Build passes locally (`npm run build`)
- All environment variables are set in Vercel
- No TypeScript errors

### Render deployment fails

**Check:**
- `render-api-server.ts` has no syntax errors
- MongoDB connection string is correct
- All environment variables are set in Render

## Quick Reference

| Service | Local | Production | Port |
|---------|-------|------------|------|
| Frontend | `npm run dev` | Vercel | 3000 |
| Backend | `npm run dev:api` | Render | 3001 |

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend only |
| `npm run dev:api` | Start backend only |
| `npm run dev:all` | Start both (single terminal) |
| `npm run build` | Build for production |

## Deployment Flow

```
1. Make changes locally
   ↓
2. Test in Terminal 1 (backend) + Terminal 2 (frontend)
   ↓
3. Commit and push to git
   ↓
4. Vercel auto-deploys frontend
   ↓
5. Render auto-deploys backend
   ↓
6. Verify production site works
```

## Notes

- **Frontend changes** → Deploy to Vercel
- **Backend changes** → Deploy to Render
- **Both can be deployed independently**
- **Local setup matches production exactly**

