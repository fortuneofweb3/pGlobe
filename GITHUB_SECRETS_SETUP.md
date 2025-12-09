# How to Add GitHub Secrets - Visual Guide

## Step-by-Step Instructions

### Step 1: Navigate to Your Repository
1. Go to: https://github.com/fortuneofweb3/pGlobe (or your repo URL)
2. Make sure you're logged in

### Step 2: Open Settings
1. Click on the **Settings** tab at the top of the repository
   - It's in the horizontal menu: Code | Issues | Pull requests | Actions | Projects | Wiki | Security | Insights | **Settings**
   - You need to be a repository owner or have admin access

### Step 3: Find Secrets Section
1. In the left sidebar, scroll down to find **Secrets and variables**
2. Click on it to expand
3. Click on **Actions** (it should be the first option)

### Step 4: Add First Secret (VERCEL_URL)
1. Click the green **New repository secret** button (top right)
2. Fill in:
   - **Name**: `VERCEL_URL`
   - **Secret**: `https://your-project.vercel.app` (replace with your actual Vercel URL)
   - Click **Add secret**

### Step 5: Add Second Secret (CRON_SECRET)
1. Click **New repository secret** again
2. Fill in:
   - **Name**: `CRON_SECRET`
   - **Secret**: Generate one first (see below)
   - Click **Add secret**

### Step 6: Generate CRON_SECRET

**Option A: Using Terminal**
```bash
openssl rand -hex 32
```

**Option B: Using Online Generator**
- Go to: https://www.random.org/strings/
- Set length to 64 characters
- Use alphanumeric characters
- Copy the generated string

**Option C: Quick Python**
```python
import secrets
print(secrets.token_hex(32))
```

## Visual Path

```
GitHub Repository
  └─ Settings (top menu)
      └─ Secrets and variables (left sidebar)
          └─ Actions
              └─ New repository secret (button)
```

## Troubleshooting

### Can't see Settings tab?
- You need to be the repository owner or have admin permissions
- If it's a fork, you might need to create your own repository

### Can't find "Secrets and variables"?
- Make sure you're in the repository Settings (not account settings)
- Scroll down in the left sidebar - it's near the bottom
- It might be under "Security" section

### Still can't find it?
Try this direct URL (replace `fortuneofweb3/pGlobe` with your username/repo):
```
https://github.com/fortuneofweb3/pGlobe/settings/secrets/actions
```

## After Adding Secrets

1. The secrets will be available to your GitHub Actions workflow
2. The workflow will automatically start running once you push the code
3. Check the **Actions** tab to see if it's working

## Verify Secrets Are Added

1. Go back to: Settings → Secrets and variables → Actions
2. You should see both `VERCEL_URL` and `CRON_SECRET` listed
3. You can click on them to update, but you can't view the values (for security)

