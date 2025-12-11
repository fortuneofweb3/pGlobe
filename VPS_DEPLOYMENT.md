# VPS Deployment - True Region Control + Unlimited Requests

## Why VPS?

- ✅ **YOU SELECT THE EXACT LOCATION** when creating server
- ✅ **Unlimited requests** (no per-request costs)
- ✅ **Cheap**: $5-10/month per server
- ✅ **Simple**: Just deploy Node.js server
- ✅ **True geographic distribution**

## Providers & Regions

### DigitalOcean (Recommended)

**$6/month per droplet:**
- NYC1 (New York) - US East ✅
- AMS3 (Amsterdam) - EU West ✅
- SGP1 (Singapore) - Asia East ✅
- **CPT1 (Cape Town)** - **Africa South** ✅

**Total: $24/month for 4 regions**

### Linode

**$5/month per instance:**
- Newark, NJ - US East
- Frankfurt - EU West
- Singapore - Asia East
- (No Africa region)

### Hetzner

**€4/month per server:**
- Falkenstein, Germany - EU West
- Helsinki, Finland - EU North
- (No US/Asia/Africa)

### AWS EC2

**Pay-as-you-go:**
- All AWS regions available
- Includes `af-south-1` (Cape Town) ✅
- More expensive but flexible

## Quick Setup (DigitalOcean)

### Step 1: Create Droplet

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create → Droplets
3. **Region:** Select region (NYC1, AMS3, SGP1, CPT1)
4. **Image:** Ubuntu 22.04
5. **Plan:** Basic $6/month
6. Click **"Create Droplet"**

### Step 2: SSH into Server

```bash
ssh root@YOUR_DROPLET_IP
```

### Step 3: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

### Step 4: Deploy Server

```bash
# Create directory
mkdir -p /opt/latency-server
cd /opt/latency-server

# Upload measurement-server.js (or clone from git)
# Then:
npm init -y
npm install express

# Create .env file
echo "REGION=us-east" > .env
# Or: REGION=eu-west, REGION=asia-east, REGION=africa-south

# Run server
node measurement-server.js
```

### Step 5: Set Up PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start measurement-server.js --name latency-server
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

### Step 6: Set Up Nginx (Reverse Proxy)

```bash
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/latency-server
```

Add:
```nginx
server {
    listen 80;
    server_name YOUR_DROPLET_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/latency-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Test

```bash
curl -X POST http://YOUR_DROPLET_IP/measure-batch \
  -H "Content-Type: application/json" \
  -d '{"targets":["173.212.203.145"],"proxyEndpoint":"https://rpc1.pchednode.com/rpc"}'
```

### Step 8: Repeat for Other Regions

Do steps 1-7 for each region:
- NYC1 (US East)
- AMS3 (EU West)
- SGP1 (Asia East)
- CPT1 (Africa South)

## Environment Variables

After deploying all 4 servers, add to **Render** and **Vercel**:

```env
VPS_US_EAST=http://YOUR_NYC1_IP
VPS_EU_WEST=http://YOUR_AMS3_IP
VPS_ASIA_EAST=http://YOUR_SGP1_IP
VPS_AFRICA_SOUTH=http://YOUR_CPT1_IP
```

## Cost Comparison

**AWS Lambda:**
- Free tier: 1M requests/month
- After: $0.20 per 1M requests
- **For 2.7M requests/month: ~$0.54/month** ✅

**VPS (DigitalOcean):**
- $6/month × 4 regions = **$24/month**
- **Unlimited requests** ✅

**Recommendation:**
- **Low traffic (< 1M requests/month):** AWS Lambda (free)
- **High traffic (> 1M requests/month):** VPS (cheaper)

## Automated Deployment Script

I can create a script that:
1. Creates droplets via DigitalOcean API
2. Installs Node.js
3. Deploys measurement server
4. Sets up PM2 + Nginx
5. Returns IP addresses

Would you like me to create this?

