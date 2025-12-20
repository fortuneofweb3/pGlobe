#!/usr/bin/env npx tsx

/**
 * Script to check versions directly from API
 * Uses the backend API endpoint that queries get-pods-with-stats
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

async function checkVersionsFromBackendAPI() {
  try {
    if (!RENDER_API_URL) {
      console.error('❌ RENDER_API_URL not set in environment');
      process.exit(1);
    }

    console.log(`📡 Querying backend API: ${RENDER_API_URL}/api/pnodes\n`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (API_SECRET) {
      headers['Authorization'] = `Bearer ${API_SECRET}`;
    }

    const response = await fetch(`${RENDER_API_URL}/api/pnodes`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();
    const nodes = data.nodes || [];

    console.log(`📊 Total nodes from API: ${nodes.length}\n`);
    
    // Count versions
    const versionMap = new Map<string, number>();
    nodes.forEach((node: any) => {
      const version = node.version || 'Unknown';
      versionMap.set(version, (versionMap.get(version) || 0) + 1);
    });
    
    // Sort by count
    const sortedVersions = Array.from(versionMap.entries())
      .map(([version, count]) => ({
        version,
        count,
        percentage: (count / nodes.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);
    
    console.log('📋 Version Distribution (from API):\n');
    sortedVersions.forEach(({ version, count, percentage }) => {
      const isTrynet = version.includes('-trynet');
      const isTest = version.includes('-test') || version.includes('-dev');
      const marker = isTrynet ? ' [TRYNET]' : isTest ? ' [TEST/DEV]' : '';
      console.log(`  ${version.padEnd(40)} ${count.toString().padStart(4)} nodes (${percentage.toFixed(1)}%)${marker}`);
    });
    
    // Summary
    const trynetCount = sortedVersions.filter(v => v.version.includes('-trynet')).reduce((sum, v) => sum + v.count, 0);
    const stableCount = nodes.length - trynetCount;
    const stableVersions = sortedVersions.filter(v => !v.version.includes('-trynet') && v.version !== 'Unknown');
    
    console.log('\n📈 Summary:');
    console.log(`  Stable versions: ${stableCount} nodes (${((stableCount / nodes.length) * 100).toFixed(1)}%)`);
    console.log(`  Trynet versions: ${trynetCount} nodes (${((trynetCount / nodes.length) * 100).toFixed(1)}%)`);
    console.log(`  Unknown: ${versionMap.get('Unknown') || 0} nodes`);
    console.log(`\n  Unique stable versions: ${stableVersions.length}`);
    console.log(`  Unique trynet versions: ${sortedVersions.filter(v => v.version.includes('-trynet')).length}`);
    
    // Show latest stable version
    if (stableVersions.length > 0) {
      const latestStable = stableVersions.sort((a, b) => {
        const aBase = a.version.replace('v', '').split('-')[0];
        const bBase = b.version.replace('v', '').split('-')[0];
        const aParts = aBase.split('.').map(Number);
        const bParts = bBase.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
      })[0];
      console.log(`\n  Latest stable version: ${latestStable.version} (${latestStable.count} nodes)\n`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkVersionsFromBackendAPI();


