#!/bin/bash

# Wait for background refresh to complete and check status

echo "⏳ Waiting 90 seconds for background refresh to complete..."
echo ""

for i in {1..9}; do
  echo "   ${i}0 seconds..."
  sleep 10
done

echo ""
echo "✅ Checking database state..."
echo ""

MONGODB_URI="$(grep MONGODB_URI .env.local | cut -d'=' -f2- | tr -d "'")" node scripts/check-deployment-status.js

