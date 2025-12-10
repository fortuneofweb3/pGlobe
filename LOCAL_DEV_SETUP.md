# Local Development Setup

This guide shows you how to run the platform locally with the same 2-server architecture as production.

## Architecture

- **Backend Server** (`render-api-server.ts`): Handles MongoDB, pRPC fetching, background refresh, all API endpoints
- **Frontend Server** (Next.js): Proxies all API requests to backend server (no direct MongoDB access)

This matches production exactly:
- **Production**: Vercel (frontend) → Render (backend)
- **Local**: Next.js (frontend) → Express API (backend)

## Prerequisites

- Node.js 18+
- MongoDB connection string
- npm or yarn

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

Create `.env.local` file:

```bash
# Backend API Server URL (local)
RENDER_API_URL=http://localhost:3001

# API Secret (generate with: openssl rand -hex 32)
API_SECRET=your-local-api-secret-here

# MongoDB Connection String
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Optional: Next.js public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 3: Start Both Servers

### Recommended: Run Servers in Separate Terminals

This matches production architecture exactly:
- **Terminal 1** = Backend (like Render)
- **Terminal 2** = Frontend (like Vercel)

**Terminal 1 - Backend Server (Port 3001):**
```bash
npm run dev:api
```

**Terminal 2 - Frontend Server (Port 3000):**
```bash
npm run dev
```

### Alternative: Run Both Together (Single Terminal)

If you prefer a single terminal:
```bash
npm run dev:all
```

This starts both servers, but you won't see separate logs clearly.

## Step 4: Verify Setup

### Terminal 1 (Backend) should show:
```
[RenderAPI] Starting server...
[RenderAPI] ✅ MongoDB indexes created
[RenderAPI] ✅ Historical data indexes created
[RenderAPI] Starting background refresh task...
[RenderAPI] ✅ Background refresh started (runs every 1 minute)
[RenderAPI] 🚀 API server running on port 3001
```

### Terminal 2 (Frontend) should show:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
```

### Test the Connection

1. **Visit** `http://localhost:3000` - should load node data from backend
2. **Check Terminal 2 logs** - you should see `[VercelProxy] Proxying ... request to backend...`
3. **Check Terminal 1 logs** - you should see `[RenderAPI] Returning X nodes from DB`

This confirms frontend → backend communication is working!

## How It Works

1. **Frontend** (Next.js) runs on port 3000
2. **Backend** (Express API) runs on port 3001
3. Frontend API routes (`/api/pnodes`, `/api/refresh-nodes`, etc.) proxy requests to backend
4. Backend handles:
   - MongoDB reads/writes
   - pRPC fetching from gossip
   - Background refresh (every 1 minute)
   - Historical data storage

## Troubleshooting

### Backend Server Not Starting

**Check:**
- `MONGODB_URI` is set correctly
- Port 3001 is not already in use
- MongoDB connection is accessible

**Error: "Cannot find module 'express'"**
```bash
npm install
```

### Frontend Can't Connect to Backend

**Check:**
- `RENDER_API_URL=http://localhost:3001` in `.env.local`
- Backend server is running on port 3001
- `API_SECRET` matches between frontend and backend

**Test backend directly:**
```bash
curl http://localhost:3001/health
```

### No Data Showing

**Check:**
- Backend logs show background refresh running
- MongoDB has data (check MongoDB Atlas dashboard)
- Network config has enabled networks (check `lib/server/network-config.ts`)

## Development Workflow

1. **Start backend** (Terminal 1): `npm run dev:api` → Runs on port 3001
2. **Start frontend** (Terminal 2): `npm run dev` → Runs on port 3000
3. **Make changes** to frontend or backend code
4. **Hot reload** will automatically restart the respective server
5. **Check logs** in both terminals for errors

### Testing Before Deployment

- **Frontend changes**: Test in Terminal 2, then deploy to **Vercel**
- **Backend changes**: Test in Terminal 1, then deploy to **Render**

This way you can test locally exactly as production works!

## Environment Variables Reference

| Variable | Local Value | Production Value |
|----------|-------------|------------------|
| `RENDER_API_URL` | `http://localhost:3001` | `https://pglobe-api-server.onrender.com` |
| `API_SECRET` | `[any secret]` | `[same as Render]` |
| `MONGODB_URI` | `[your MongoDB URI]` | `[same as Render]` |

## Notes

- Backend server runs background refresh every 1 minute (same as production)
- Historical data is stored in MongoDB (same as production)
- All API routes proxy to backend (same as production)
- This matches the production architecture exactly!

