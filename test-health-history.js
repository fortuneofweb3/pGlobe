/**
 * Test script to check network health history API
 * This will query the actual API and show what's being returned
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

async function testHealthHistory() {
  console.log('🔍 Testing Network Health History API...\n');
  console.log('Configuration:');
  console.log('  RENDER_API_URL:', RENDER_API_URL || 'NOT SET');
  console.log('  API_SECRET:', API_SECRET ? 'SET' : 'NOT SET');
  console.log('');

  if (!RENDER_API_URL) {
    console.error('❌ RENDER_API_URL not configured');
    process.exit(1);
  }

  // Test 1: Direct backend API call
  console.log('📡 Test 1: Direct backend API call');
  try {
    const backendUrl = `${RENDER_API_URL}/api/v1/network/health/history?period=7d`;
    console.log('  URL:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
      },
    });

    console.log('  Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('  Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('  ✅ Success');
      console.log('  Data points:', data.data.dataPoints || 0);
      console.log('  Health array length:', data.data.health?.length || 0);
      
      if (data.data.health && data.data.health.length > 0) {
        console.log('  Sample data point:', JSON.stringify(data.data.health[0], null, 2));
      } else {
        console.log('  ⚠️  No health data in response');
      }
    } else {
      console.log('  ❌ Failed or invalid response');
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  console.log('\n');

  // Test 2: Frontend proxy API call (if running locally)
  console.log('📡 Test 2: Frontend proxy API call');
  try {
    const frontendUrl = 'http://localhost:3000/api/v1/network/health/history?period=7d';
    console.log('  URL:', frontendUrl);
    
    const response = await fetch(frontendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('  Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('  Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('  ✅ Success');
      console.log('  Data points:', data.data.dataPoints || 0);
      console.log('  Health array length:', data.data.health?.length || 0);
    } else {
      console.log('  ❌ Failed or invalid response');
    }
  } catch (error) {
    console.error('  ❌ Error (frontend may not be running):', error.message);
  }

  console.log('\n');

  // Test 3: Check MongoDB directly (if we can)
  console.log('📡 Test 3: Checking if we can query MongoDB directly');
  try {
    const { getHistoricalSnapshots } = require('./lib/server/mongodb-history.ts');
    const now = Date.now();
    const startTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    console.log('  Querying snapshots from', new Date(startTime).toISOString(), 'to', new Date(now).toISOString());
    
    const snapshots = await getHistoricalSnapshots(startTime, now, 1000);
    console.log('  Found snapshots:', snapshots.length);
    
    if (snapshots.length > 0) {
      console.log('  Sample snapshot:', JSON.stringify({
        timestamp: snapshots[0].timestamp,
        interval: snapshots[0].interval,
        totalNodes: snapshots[0].totalNodes,
        onlineNodes: snapshots[0].onlineNodes,
        networkHealthScore: snapshots[0].networkHealthScore,
        networkHealthAvailability: snapshots[0].networkHealthAvailability,
        networkHealthVersion: snapshots[0].networkHealthVersion,
        networkHealthDistribution: snapshots[0].networkHealthDistribution,
      }, null, 2));
    } else {
      console.log('  ⚠️  No snapshots found in MongoDB');
      console.log('  This means historical snapshots are not being stored.');
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    console.log('  (This is expected if MongoDB is not accessible from this script)');
  }
}

testHealthHistory().catch(console.error);

