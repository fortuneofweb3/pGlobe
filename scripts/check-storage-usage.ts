/**
 * Check if pNodes actually use storage
 * - Query database for nodes with storage values
 * - Do direct pRPC calls to actual nodes to see what they return
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import * as http from 'http';
import { getAllNodes } from '../lib/server/mongodb-nodes';

// Direct pRPC endpoints to test
const TEST_ENDPOINTS = [
  '173.212.203.145:6000',
  '173.212.220.65:6000',
  '161.97.97.41:6000',
  '192.190.136.36:6000',
  '192.190.136.37:6000',
];

function httpPost(url: string, data: object, timeoutMs: number = 5000): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? require('https') : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
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
            resolve(JSON.parse(responseData));
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

async function callPRPC(url: string, method: string): Promise<any | null> {
  const payload = { jsonrpc: '2.0', method, id: 1, params: [] };
  const response = await httpPost(url, payload, 10000);
  return response?.result || null;
}

async function checkDatabaseNodes() {
  console.log('\n=== CHECKING DATABASE NODES ===\n');
  
  const nodes = await getAllNodes();
  console.log(`Total nodes in database: ${nodes.length}`);
  
  const nodesWithStorageUsed = nodes.filter(n => n.storageUsed !== undefined && n.storageUsed !== null);
  const nodesWithStorageCapacity = nodes.filter(n => n.storageCapacity !== undefined && n.storageCapacity !== null);
  const nodesWithStorageCommitted = nodes.filter(n => n.storageCommitted !== undefined && n.storageCommitted !== null);
  
  console.log(`\nNodes with storageUsed: ${nodesWithStorageUsed.length}`);
  console.log(`Nodes with storageCapacity: ${nodesWithStorageCapacity.length}`);
  console.log(`Nodes with storageCommitted: ${nodesWithStorageCommitted.length}`);
  
  if (nodesWithStorageUsed.length > 0) {
    console.log('\nSample nodes with storageUsed:');
    nodesWithStorageUsed.slice(0, 10).forEach(n => {
      console.log(`  ${n.pubkey?.substring(0, 20)}... | used: ${n.storageUsed}, capacity: ${n.storageCapacity}, committed: ${n.storageCommitted}`);
    });
  }
  
  if (nodesWithStorageCapacity.length > 0 && nodesWithStorageUsed.length === 0) {
    console.log('\n⚠️  Nodes have capacity but NO usage data!');
  }
  
  return { nodes, nodesWithStorageUsed, nodesWithStorageCapacity };
}

async function testDirectPRPCCalls() {
  console.log('\n=== TESTING DIRECT pRPC CALLS ===\n');
  
  for (const endpoint of TEST_ENDPOINTS) {
    console.log(`\nTesting ${endpoint}...`);
    
    const url = `http://${endpoint}/rpc`;
    
    // Try get-pods-with-stats
    console.log('  Calling get-pods-with-stats...');
    const podsWithStats = await callPRPC(url, 'get-pods-with-stats');
    
    if (podsWithStats && Array.isArray(podsWithStats) && podsWithStats.length > 0) {
      const firstPod = podsWithStats[0];
      console.log('  ✅ Response received');
      console.log('  Fields in first pod:', Object.keys(firstPod).join(', '));
      console.log('  Storage fields:');
      console.log(`    storage_used: ${firstPod.storage_used ?? 'NOT PRESENT'}`);
      console.log(`    storageUsed: ${firstPod.storageUsed ?? 'NOT PRESENT'}`);
      console.log(`    storage_committed: ${firstPod.storage_committed ?? 'NOT PRESENT'}`);
      console.log(`    storageCommitted: ${firstPod.storageCommitted ?? 'NOT PRESENT'}`);
      console.log(`    storage_capacity: ${firstPod.storage_capacity ?? 'NOT PRESENT'}`);
      console.log(`    storageCapacity: ${firstPod.storageCapacity ?? 'NOT PRESENT'}`);
      console.log(`    file_size: ${firstPod.file_size ?? 'NOT PRESENT'}`);
      console.log(`    total_bytes: ${firstPod.total_bytes ?? 'NOT PRESENT'}`);
      
      // Check all pods for storage values
      const podsWithStorageUsed = podsWithStats.filter((p: any) => 
        (p.storage_used !== undefined && p.storage_used !== null) ||
        (p.storageUsed !== undefined && p.storageUsed !== null)
      );
      console.log(`\n  Pods with storage_used: ${podsWithStorageUsed.length}/${podsWithStats.length}`);
      
      if (podsWithStorageUsed.length > 0) {
        console.log('  Sample storage values:');
        podsWithStorageUsed.slice(0, 5).forEach((p: any, i: number) => {
          console.log(`    Pod ${i + 1}: used=${p.storage_used ?? p.storageUsed}, committed=${p.storage_committed ?? p.storageCommitted}`);
        });
      } else {
        console.log('  ⚠️  NO pods have storage_used values!');
      }
    } else {
      console.log('  ❌ No response or empty array');
    }
    
    // Try get-stats on first pod
    if (podsWithStats && Array.isArray(podsWithStats) && podsWithStats.length > 0) {
      const firstPod = podsWithStats[0];
      const podAddress = firstPod.address;
      if (podAddress) {
        const ip = podAddress.split(':')[0];
        const port = firstPod.rpc_port || 6000;
        console.log(`\n  Testing get-stats on ${ip}:${port}...`);
        
        const stats = await callPRPC(`http://${ip}:${port}/rpc`, 'get-stats');
        if (stats) {
          console.log('  ✅ get-stats response received');
          console.log('  Storage fields in get-stats:');
          console.log(`    file_size: ${stats.file_size ?? 'NOT PRESENT'}`);
          console.log(`    storage_used: ${stats.storage_used ?? 'NOT PRESENT'}`);
          console.log(`    storage_committed: ${stats.storage_committed ?? 'NOT PRESENT'}`);
          console.log(`    total_bytes: ${stats.total_bytes ?? 'NOT PRESENT'}`);
        } else {
          console.log('  ❌ get-stats failed or no response');
        }
      }
    }
  }
}

async function testProxyEndpoints() {
  console.log('\n=== TESTING PROXY RPC ENDPOINTS ===\n');
  
  const proxyEndpoints = [
    'https://rpc1.pchednode.com/rpc',
    'https://rpc2.pchednode.com/rpc',
  ];
  
  for (const url of proxyEndpoints) {
    console.log(`\nTesting ${url}...`);
    const podsWithStats = await callPRPC(url, 'get-pods-with-stats');
    
    if (podsWithStats && Array.isArray(podsWithStats) && podsWithStats.length > 0) {
      const firstPod = podsWithStats[0];
      const podsWithStorageUsed = podsWithStats.filter((p: any) => 
        (p.storage_used !== undefined && p.storage_used !== null && p.storage_used > 0) ||
        (p.storageUsed !== undefined && p.storageUsed !== null && p.storageUsed > 0)
      );
      
      console.log(`  Total pods: ${podsWithStats.length}`);
      console.log(`  Pods with storage_used > 0: ${podsWithStorageUsed.length}`);
      console.log(`  First pod storage_used: ${firstPod.storage_used ?? firstPod.storageUsed ?? 'NOT PRESENT'}`);
      
      if (podsWithStorageUsed.length === 0) {
        console.log('  ⚠️  NO pods have storage_used values!');
      }
    } else {
      console.log('  ❌ No response');
    }
  }
}

async function main() {
  console.log('🔍 Checking if pNodes actually use storage...\n');
  
  try {
    // Check database
    const dbResult = await checkDatabaseNodes();
    
    // Test direct pRPC calls
    await testDirectPRPCCalls();
    
    // Test proxy endpoints
    await testProxyEndpoints();
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Database: ${dbResult.nodesWithStorageUsed.length}/${dbResult.nodes.length} nodes have storageUsed`);
    
    if (dbResult.nodesWithStorageUsed.length === 0) {
      console.log('\n❌ CONCLUSION: No nodes in database have storage usage data!');
      console.log('   Storage tracking may not be applicable for pNodes.');
    } else {
      console.log('\n✅ CONCLUSION: Some nodes have storage usage data.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

main();


