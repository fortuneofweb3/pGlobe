#!/usr/bin/env npx tsx

/**
 * Script to check versions from API
 * Tries multiple approaches: backend API, frontend API proxy, or direct RPC
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import * as http from 'http';
import { NETWORK_CONFIGS } from '../lib/server/network-config';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

async function fetchFromBackendAPI(): Promise<any[]> {
  if (!RENDER_API_URL) {
    console.log('⚠️  RENDER_API_URL not set, skipping backend API');
    return [];
  }

  try {
    console.log(`📡 Trying backend API: ${RENDER_API_URL}/api/pnodes`);
    
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.nodes || [];
  } catch (error: any) {
    console.log(`  ❌ Failed: ${error.message}`);
    return [];
  }
}

function httpPost(url: string, data: object, timeoutMs: number = 30000): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? require('https') : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname || '/rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      };

      const req = httpModule.request(options, (res: any) => {
        let responseData = '';
        res.on('data', (chunk: any) => responseData += chunk.toString());
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed?.result || parsed);
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(postData);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

async function callPRPC(endpoint: string, method: string): Promise<any | null> {
  const url = endpoint.startsWith('http') ? endpoint : `http://${endpoint}/rpc`;
  const payload = { jsonrpc: '2.0', method, id: 1, params: [] };
  return await httpPost(url, payload, 30000);
}

async function fetchFromDirectRPC(): Promise<any[]> {
  console.log('\n📡 Trying direct RPC calls to network endpoints...\n');
  
  const enabledNetworks = NETWORK_CONFIGS.filter(n => n.enabled);
  const allPods: any[] = [];
  const visited = new Set<string>();

  for (const network of enabledNetworks) {
    try {
      console.log(`  Querying ${network.rpcUrl}...`);
      const result = await callPRPC(network.rpcUrl, 'get-pods-with-stats');
      
      if (result && Array.isArray(result)) {
        console.log(`    ✅ Got ${result.length} pods`);
        result.forEach((pod: any) => {
          const address = pod.address || pod.ip_address;
          if (address && !visited.has(address)) {
            visited.add(address);
            allPods.push({
              version: pod.version,
              address: address,
            });
          }
        });
      } else {
        // Try fallback
        const fallbackResult = await callPRPC(network.rpcUrl, 'get-pods');
        if (fallbackResult && Array.isArray(fallbackResult)) {
          console.log(`    ✅ Got ${fallbackResult.length} pods (via get-pods)`);
          fallbackResult.forEach((pod: any) => {
            const address = pod.address || pod.ip_address;
            if (address && !visited.has(address)) {
              visited.add(address);
              allPods.push({
                version: pod.version,
                address: address,
              });
            }
          });
        } else {
          console.log(`    ⚠️  No pods returned`);
        }
      }
    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
    }
  }

  return allPods;
}

async function checkVersions() {
  try {
    console.log('🔍 Checking versions from API...\n');
    
    // Try backend API first
    let nodes: any[] = await fetchFromBackendAPI();
    
    // If that didn't work, try direct RPC
    if (nodes.length === 0) {
      nodes = await fetchFromDirectRPC();
    }

    if (nodes.length === 0) {
      console.log('\n❌ Could not fetch nodes from any source');
      console.log('   Tried:');
      if (RENDER_API_URL) console.log(`   - Backend API: ${RENDER_API_URL}/api/pnodes`);
      console.log('   - Direct RPC calls to network endpoints');
      process.exit(1);
    }

    console.log(`\n📊 Total nodes from API: ${nodes.length}\n`);
    
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
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkVersions();





