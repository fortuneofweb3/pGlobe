#!/bin/bash
# Deploy Deno Deploy latency measurement endpoints
# Run: chmod +x deploy-deno.sh && ./deploy-deno.sh

export PATH="$HOME/.deno/bin:$PATH"

echo "🚀 Deploying Deno Deploy latency endpoints..."
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed"
    echo "Install with: curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# Login to Deno Deploy (if not already logged in)
echo "📝 Checking Deno Deploy login..."
deno deploy whoami 2>/dev/null || deno deploy login

echo ""
echo "📦 Deploying to 4 regions..."
echo ""

# Deploy to each region
regions=("us-east" "eu-west" "asia-east" "africa-west")

for region in "${regions[@]}"; do
    echo "Deploying to $region..."
    
    app_name="latency-$region"
    
    # Deploy the file (deno deploy expects directory, so we specify the file explicitly)
    # We need to deploy from current directory and specify the entry point
    output=$(deno deploy \
        --app="$app_name" \
        --prod \
        -- \
        deno-deploy-latency.ts 2>&1)
    
    deploy_exit=$?
    
    if [ $deploy_exit -eq 0 ]; then
        # Set environment variable after deployment
        deno deploy env set REGION="$region" --app="$app_name" 2>/dev/null || true
        
        # Get the URL from the output
        url=$(echo "$output" | grep -oE 'https://[a-zA-Z0-9-]+\.deno\.dev' | head -1)
        if [ -z "$url" ]; then
            # Try alternative pattern
            url=$(echo "$output" | grep -oE 'https://[^[:space:]]*deno[^[:space:]]*' | head -1)
        fi
        if [ -z "$url" ]; then
            # Construct URL from app name (typical pattern)
            url="https://$app_name.deno.dev"
        fi
        
        echo "✅ $region deployed: $url"
        echo ""
    else
        echo "❌ Failed to deploy $region"
        echo "$output" | head -10
        echo ""
        echo "💡 Try deploying manually:"
        echo "   deno deploy --app=$app_name --prod deno-deploy-latency.ts"
        echo ""
    fi
done

echo "✅ All deployments complete!"
echo ""
echo "📋 Environment Variables to Set:"
echo ""

# Generate environment variables
for region in "${regions[@]}"; do
    env_var=$(echo "$region" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
    env_var="DENO_DEPLOY_${env_var}"
    app_name="latency-$region"
    url="https://$app_name.deno.dev"
    
    echo "   $env_var=$url"
done

echo ""
echo "💡 Copy the URLs above and add them to your Render/Vercel environment variables"
echo "💡 Note: If URLs don't work, check https://dash.deno.com/projects for actual URLs"

