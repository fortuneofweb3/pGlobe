#!/usr/bin/env npx tsx

/**
 * Script to check what versions are currently reported by nodes via API
 * Calls get-pods-with-stats directly from known endpoints
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import * as http from 'http';
import { NETWORK_CONFIGS } from '../lib/server/network-config';

// Get initial endpoints from network config
const INITIAL_ENDPOINTS = NETWORK_CONFIGS
  .filter(n => n.enabled)
  .map(n => n.rpcUrl);

function httpPost(url: string, data: object, timeoutMs: number = 10000): Promise<any | null> {
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
            resolve(parsed?.result || null);
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

async function getAllNodesFromNetwork(): Promise<Array<{ address: string; version?: string }>> {
  const allNodes: Array<{ address: string; version?: string }> = [];
  const visited = new Set<string>();
  const queue: string[] = [...INITIAL_ENDPOINTS];

  console.log(`\n🔍 Starting network crawl from ${INITIAL_ENDPOINTS.length} initial endpoints...\n`);

  while (queue.length > 0 && visited.size < 50) { // Limit to prevent infinite loops
    const endpoint = queue.shift()!;
    if (visited.has(endpoint)) continue;
    visited.add(endpoint);

    try {
      console.log(`Querying ${endpoint}...`);
      const result = await callPRPC(endpoint, 'get-pods-with-stats');
      
      if (result && Array.isArray(result)) {
        result.forEach((pod: any) => {
          const address = pod.address || pod.ip_address;
          const version = pod.version;
          
          if (address && !allNodes.find(n => n.address === address)) {
            allNodes.push({ address, version });
            
            // Add to queue if we haven't visited it yet
            if (address && !visited.has(address)) {
              queue.push(address);
            }
          }
        });
        
        console.log(`  ✅ Found ${result.length} pods, total unique: ${allNodes.length}`);
      } else {
        // Fallback to get-pods
        const fallbackResult = await callPRPC(endpoint, 'get-pods');
        if (fallbackResult && Array.isArray(fallbackResult)) {
          fallbackResult.forEach((pod: any) => {
            const address = pod.address || pod.ip_address;
            const version = pod.version;
            
            if (address && !allNodes.find(n => n.address === address)) {
              allNodes.push({ address, version });
              
              if (address && !visited.has(address)) {
                queue.push(address);
              }
            }
          });
          console.log(`  ✅ Found ${fallbackResult.length} pods (via get-pods), total unique: ${allNodes.length}`);
        } else {
          console.log(`  ⚠️  No pods returned`);
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  return allNodes;
}

async function checkVersionsFromAPI() {
  try {
    console.log('📡 Querying nodes directly via get-pods-with-stats API...\n');
    
    const nodes = await getAllNodesFromNetwork();
    
    console.log(`\n📊 Total unique nodes found: ${nodes.length}\n`);
    
    // Count versions
    const versionMap = new Map<string, number>();
    nodes.forEach((node) => {
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
    console.log(`  Unique trynet versions: ${sortedVersions.filter(v => v.version.includes('-trynet')).length}\n`);
    
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
      console.log(`  Latest stable version: ${latestStable.version} (${latestStable.count} nodes)\n`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkVersionsFromAPI();

