#!/bin/bash

# Trigger Render deployment manually
# You'll need your Render API key from: https://dashboard.render.com/u/settings#api-keys

RENDER_API_KEY="${RENDER_API_KEY:-}"
SERVICE_ID="${RENDER_SERVICE_ID:-}"

if [ -z "$RENDER_API_KEY" ]; then
  echo "❌ RENDER_API_KEY not set"
  echo ""
  echo "To trigger deployment:"
  echo "1. Get your API key from: https://dashboard.render.com/u/settings#api-keys"
  echo "2. Find your service ID from: https://dashboard.render.com"
  echo "3. Run:"
  echo "   export RENDER_API_KEY='your-key'"
  echo "   export RENDER_SERVICE_ID='srv-xxxxx'"
  echo "   bash scripts/trigger-render-deploy.sh"
  echo ""
  echo "OR just go to:"
  echo "   https://dashboard.render.com"
  echo "   → Select 'pglobe-api-server'"
  echo "   → Click 'Manual Deploy' → 'Deploy latest commit'"
  exit 1
fi

if [ -z "$SERVICE_ID" ]; then
  echo "❌ RENDER_SERVICE_ID not set"
  echo "Find it in your Render dashboard URL: https://dashboard.render.com/web/srv-XXXXX"
  exit 1
fi

echo "🚀 Triggering Render deployment..."
echo "Service ID: $SERVICE_ID"

response=$(curl -X POST \
  "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": false}')

echo "$response" | jq '.'

echo ""
echo "✅ Deployment triggered!"
echo "Check status: https://dashboard.render.com/web/$SERVICE_ID"

