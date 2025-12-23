# Fixes Summary - Background Sync & Credits Display

## Issues Fixed

### 1. ✅ Credits Earned/Lost Display
**Problem**: The credits chart was using `Math.max(0, creditsDiff)` which prevented showing negative values (credits lost).

**Solution**: 
- Removed the `Math.max(0, ...)` constraint to allow negative values
- Updated Y-axis domain to include negative values: `[minCredits * 1.1 || -10, maxCredits * 1.1 || 10]`
- Changed chart title from "Credits Earned" to "Credits Earned / Lost"
- Updated tooltip to show "Credits Lost" (in red) for negative values and "Credits Earned" (in green) for positive values
- Added +/- signs to Y-axis labels for clarity

**Files Modified**: 
- `components/NodeDetailsModal.tsx` (lines 1350-1428)

### 2. ✅ Background Sync Improvements
**Problem**: Background sync on Render was not happening automatically. The passive polling interval was resetting frequently due to `nodes.length` dependency.

**Solution**:
- Removed `nodes.length` from passive polling dependencies to prevent interval resets
- Added comprehensive logging to track when background syncs are triggered
- Added diagnostic script `check-render-sync.js` to verify Render server status

**Files Modified**:
- `lib/context/NodesContext.tsx` (lines 211-275)
- Added `check-render-sync.js` diagnostic tool

## How Background Sync Works

### Render Server (Automatic)
The Render API server (`render-api-server.ts`) automatically runs a background refresh every 60 seconds:
1. Fetches nodes from pRPC/gossip
2. Enriches with location, balance, credits
3. Writes to MongoDB
4. Stores historical snapshots

### Frontend (Client-side)
The frontend has two mechanisms:

1. **Initial Trigger** (on page load):
   - If last refresh was >60s ago, triggers `/api/refresh-nodes` which proxies to Render
   - This ensures MongoDB is updated when users visit

2. **Passive Polling** (every 60s):
   - Fetches latest data from MongoDB every minute
   - Keeps UI updated without triggering expensive background operations
   - Now properly maintains interval without resets

## Verifying Everything Works

### 1. Check Render Server Status
```bash
node check-render-sync.js
```

This will:
- Check if Render server is running
- Show server uptime
- Trigger a manual background refresh
- Display total nodes in DB

### 2. Check Frontend Logs
Open browser console and look for:
```
[NodesContext] Triggering background refresh on Render (last refresh was Xs ago)
[NodesContext] Calling /api/refresh-nodes...
[NodesContext] ✅ Background refresh completed: {...}
[NodesContext] Starting passive polling (every 60s)
[NodesContext] Passive polling tick - fetching fresh data...
```

### 3. Verify Credits Display
1. Open any node's details modal
2. Scroll to "Credits Earned / Lost" chart
3. You should see:
   - Green lines/bars for credits earned (positive values)
   - Red lines/bars for credits lost (negative values)
   - Y-axis with +/- labels
   - Tooltip showing "Credits Earned" or "Credits Lost" based on value

## Troubleshooting

### Background Sync Not Working
1. **Check Render server is running**:
   ```bash
   node check-render-sync.js
   ```

2. **Check environment variables**:
   - `RENDER_API_URL` must be set in `.env.local`
   - `API_SECRET` must match between Vercel and Render

3. **Check Render logs**:
   - Go to Render dashboard
   - View logs for `pglobe-api-server`
   - Look for `[BackgroundRefresh]` entries every 60 seconds

4. **Check MongoDB connection**:
   - Background refresh requires MongoDB to be connected
   - Check Render logs for MongoDB connection errors

### Credits Not Showing
1. **Check historical data**:
   - Credits chart requires historical snapshots
   - If node is new, wait 10+ minutes for data to accumulate

2. **Check credits API**:
   - The `credits` field comes from `https://podcredits.xandeum.network/api/pods-credits`
   - Verify this API is accessible from Render server

3. **Check MongoDB history collection**:
   - Historical snapshots are stored in `node_history` collection
   - Use MongoDB Compass to verify snapshots exist

## Next Steps

1. **Test the fixes**:
   - Reload the application
   - Check browser console for background sync logs
   - Open a node modal and verify credits display

2. **Monitor Render logs**:
   - Ensure background refresh is running every 60 seconds
   - Look for any errors or warnings

3. **Clear localStorage** (if needed):
   ```javascript
   localStorage.removeItem('lastServerRefresh')
   ```
   Then reload to force immediate background sync

## Changes Made

### NodeDetailsModal.tsx
```typescript
// Before: Credits earned (only positive)
creditsEarned = Math.max(0, creditsDiff);
yDomain={[0, maxCredits * 1.1 || 10]}

// After: Credits earned/lost (positive and negative)
creditsEarned = creditsDiff;
yDomain={[minCredits * 1.1 || -10, maxCredits * 1.1 || 10]}
```

### NodesContext.tsx
```typescript
// Before: Interval resets when nodes.length changes
}, [refreshNodes, nodes.length]);

// After: Interval persists
}, [refreshNodes]);

// Added comprehensive logging throughout
console.log('[NodesContext] Triggering background refresh...')
console.log('[NodesContext] ✅ Background refresh completed:', data)
console.log('[NodesContext] ❌ Background refresh failed:', data)
```




