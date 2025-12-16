# 🚨 CRITICAL: Deploy to Render NOW

## What We Just Fixed

1. **Merge Strategy**: Tracks IP changes in `previousAddresses` array
2. **Critical Bug**: Different pubkeys at same IP were being deleted (now keeps all)

## Current Status

- ✅ Code pushed to GitHub (commits: `aedc0b6`, `88eeaa1`)
- ✅ Background refresh is running
- ❌ **Render has NOT deployed the new code**
- ❌ Still losing nodes due to the bug!

## Impact of Not Deploying

**Every minute**, nodes with unique pubkeys at shared IPs are being **DELETED** by the old buggy code!

## How to Deploy (2 minutes)

### Step 1: Go to Render Dashboard
```
https://dashboard.render.com
```

### Step 2: Find Your Service
- Look for: `pglobe-api-server`
- Or: The service running your API server

### Step 3: Deploy Latest Commit
- Click **"Manual Deploy"** (top right)
- Select **"Deploy latest commit"**
- Wait ~2-3 minutes for build

### Step 4: Verify Deployment
After ~3 minutes, run:
```bash
MONGODB_URI="$(grep MONGODB_URI .env.local | cut -d'=' -f2- | tr -d "'")" node scripts/check-deployment-status.js
```

You should see:
- ✅ Merge strategy: Working
- ✅ Bug fix: Working
- 📈 Node count: Increased (previously lost nodes restored)

## Expected After Deployment

### Immediate (within 1 minute):
- Background refresh runs with new code
- Nodes with different pubkeys at same IP are kept (not deleted)
- Merge strategy activates for duplicate pubkeys

### Within 5 minutes:
- `previousAddresses` field populated for nodes with IP changes
- Node count increases as previously deleted nodes are restored
- All unique nodes are preserved

## Why Auto-Deploy Isn't Working

If this isn't deploying automatically, check:
1. Go to Render Dashboard → Service
2. Click **Settings**
3. Look for **"Auto-Deploy"** setting
4. Make sure it's set to **"Yes"** for branch **"main"**

## Latest Commits to Deploy

```
88eeaa1 - fix: allow multiple different pubkeys at same IP address (CRITICAL)
aedc0b6 - feat: implement merge strategy for nodes with same pubkey but different IPs
```

## What Happens After Deploy

1. **Within 1 minute**: Next background refresh uses new code
2. **Nodes restored**: Previously deleted nodes come back
3. **No more data loss**: All unique pubkeys preserved
4. **IP history tracked**: Nodes that change IPs have history

## Verification Commands

After deployment, run these to verify:

```bash
# Check deployment status
MONGODB_URI="your-uri" node scripts/check-deployment-status.js

# Check for missing nodes
MONGODB_URI="your-uri" node scripts/check-missing-nodes-simple.js

# Check overall status
MONGODB_URI="your-uri" node scripts/check-new-nodes.js
```

---

**⚡ DEPLOY NOW to stop losing nodes!**

