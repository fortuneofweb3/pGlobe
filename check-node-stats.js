/**
 * Script to check CPU and RAM stats directly from Xandeum pRPC API
 * Uses the same approach as our backend: get-pods-with-stats/get-pods, then get-stats
 * Usage: node check-node-stats.js
 */

const NODE_IP = '192.190.136.28';
const NODE_ADDRESS = '192.190.136.28:9001';
const NODE_PUBKEY = 'GCoCP7CLvVivuWUH1sSA9vMi9jjaJcXpMwVozMVA6yBg';

// Same endpoints as backend
const PROXY_RPC_ENDPOINTS = [
  'https://rpc1.pchednode.com/rpc',
  'https://rpc2.pchednode.com/rpc',
  'https://rpc3.pchednode.com/rpc',
  'https://rpc4.pchednode.com/rpc',
];

const DIRECT_PRPC_ENDPOINTS = [
  '173.212.203.145:6000',
  '173.212.220.65:6000',
  '161.97.97.41:6000',
  '192.190.136.36:6000',
  '192.190.136.37:6000',
  '192.190.136.38:6000',
  '192.190.136.28:6000', // Our target node
  '192.190.136.29:6000',
  '207.244.255.1:6000',
  '173.249.59.66:6000',
  '173.249.54.191:6000',
];

// Use Node.js http module exactly like backend does
const http = require('http');
const https = require('https');

function httpPost(url, data, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

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

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk.toString());
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

async function callPRPC(url, method, timeout = 10000) {
  // Ensure URL format matches backend
  let fullUrl = url;
  if (!url.startsWith('http')) {
    fullUrl = `http://${url}`;
  }
  if (!fullUrl.endsWith('/rpc')) {
    fullUrl = fullUrl.endsWith('/') ? `${fullUrl}rpc` : `${fullUrl}/rpc`;
  }
  
  const payload = {
    jsonrpc: '2.0',
    method: method,
    id: 1,
    params: []
  };

  return await httpPost(fullUrl, payload, timeout);
}

async function fetchNodesFromEndpoint(endpoint) {
  const url = endpoint.startsWith('http') ? endpoint : `http://${endpoint}/rpc`;
  
  // Try get-pods-with-stats first (v0.7.0+), fallback to get-pods - exactly like backend
  let result = await callPRPC(url, 'get-pods-with-stats', 30000);
  if (!result) {
    result = await callPRPC(url, 'get-pods', 20000);
  }
  if (!result) return [];
  
  // Extract pods array from response - exactly like backend
  const pods = Array.isArray(result) ? result 
    : result.pods || result.nodes || result.result?.pods || [];
  
  return pods;
}

async function fetchStatsForNode(node) {
  const ip = node.address?.split(':')[0];
  if (!ip) return null;
  
  // Try ports exactly like backend does
  const portsToTry = [node.rpc_port || 6000, 6000, 9000];
  
  for (const port of portsToTry) {
    const result = await callPRPC(`http://${ip}:${port}/rpc`, 'get-stats', 2000);
    if (result) return result;
  }
  
  return null;
}

async function checkNodeStats() {
  try {
    console.log(`\n🔍 Fetching CPU and RAM for: ${NODE_ADDRESS}`);
    console.log(`   Pubkey: ${NODE_PUBKEY}\n`);
    
    console.log('Step 1: Fetching all nodes from gossip (get-pods-with-stats / get-pods)...\n');
    
    // Fetch from all endpoints - exactly like backend
    const allEndpoints = [...PROXY_RPC_ENDPOINTS, ...DIRECT_PRPC_ENDPOINTS];
    const results = await Promise.allSettled(
      allEndpoints.map(ep => fetchNodesFromEndpoint(ep))
    );
    
    // Collect all nodes
    const allNodes = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNodes.push(...result.value);
      }
    }
    
    console.log(`✅ Fetched ${allNodes.length} nodes from gossip network\n`);
    
    // Find our target node
    const nodeInfo = allNodes.find(pod => {
      const podAddress = pod.address || '';
      const podIP = podAddress.split(':')[0];
      const podPubkey = pod.pubkey || pod.publicKey;
      return podIP === NODE_IP || 
             podAddress === NODE_ADDRESS ||
             podPubkey === NODE_PUBKEY;
    });
    
    if (!nodeInfo) {
      console.log('❌ Node not found in gossip network');
      console.log(`\n💡 Searched ${allNodes.length} nodes from ${allEndpoints.length} endpoints`);
      return;
    }
    
    console.log('✅ Found node in gossip network!\n');
    console.log('Step 2: Fetching detailed stats via get-stats...\n');
    
    // Get detailed stats - exactly like backend
    const stats = await fetchStatsForNode(nodeInfo);
    
    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 NODE INFORMATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Address:      ${nodeInfo.address || NODE_ADDRESS}`);
    console.log(`Public Key:   ${nodeInfo.pubkey || nodeInfo.publicKey || NODE_PUBKEY}`);
    console.log(`Version:      ${nodeInfo.version || 'N/A'}`);
    console.log(`Location:     Bettendorf, United States`);
    console.log(`RPC Port:     ${nodeInfo.rpc_port || 6000}`);
    console.log(`Is Public:    ${nodeInfo.is_public !== false ? 'Yes' : 'No'}`);
    
    if (stats) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('💻 RESOURCE USAGE (Live from pRPC get-stats)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // CPU
      if (stats.cpu_percent !== undefined && stats.cpu_percent !== null) {
        console.log(`CPU Usage:    ${stats.cpu_percent.toFixed(2)}%`);
      } else {
        console.log(`CPU Usage:    ❌ Not available`);
      }
      
      // RAM
      if (stats.ram_used !== undefined && stats.ram_total !== undefined) {
        const ramUsedGB = (stats.ram_used / (1024 ** 3)).toFixed(2);
        const ramTotalGB = (stats.ram_total / (1024 ** 3)).toFixed(2);
        const ramPercent = ((stats.ram_used / stats.ram_total) * 100).toFixed(2);
        console.log(`RAM Used:     ${ramUsedGB} GB / ${ramTotalGB} GB (${ramPercent}%)`);
      } else if (stats.ram_used !== undefined) {
        const ramUsedGB = (stats.ram_used / (1024 ** 3)).toFixed(2);
        console.log(`RAM Used:     ${ramUsedGB} GB`);
      } else {
        console.log(`RAM Usage:    ❌ Not available`);
      }
      
      // Additional stats
      if (stats.uptime) {
        const hours = Math.floor(stats.uptime / 3600);
        const minutes = Math.floor((stats.uptime % 3600) / 60);
        console.log(`Uptime:       ${hours}h ${minutes}m`);
      }
      if (stats.packets_received !== undefined) {
        console.log(`Packets Rx:   ${stats.packets_received.toLocaleString()}`);
      }
      if (stats.packets_sent !== undefined) {
        console.log(`Packets Tx:   ${stats.packets_sent.toLocaleString()}`);
      }
      if (stats.active_streams !== undefined) {
        console.log(`Active Streams: ${stats.active_streams}`);
      }
    } else {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('💻 RESOURCE USAGE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`CPU Usage:    ❌ Could not fetch (pRPC not accessible)`);
      console.log(`RAM Usage:    ❌ Could not fetch (pRPC not accessible)`);
      console.log(`\n💡 The node's pRPC endpoint is not publicly accessible.`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n');
  }
}

checkNodeStats();
