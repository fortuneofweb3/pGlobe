/**
 * Local test script for latency measurement
 * Run with: node test-latency-local.js
 */

const http = require('http');
const https = require('https');

async function measureLatency(target, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(target);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      method: 'get-version',
      id: 1,
      params: [],
    });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: timeoutMs,
    };
    
    const req = httpModule.request(options, (res) => {
      res.once('data', () => {
        const latency = Date.now() - startTime;
        res.on('data', () => {});
        res.on('end', () => {
          req.destroy();
          resolve(latency);
        });
      });
      
      res.on('error', () => {
        const elapsed = Date.now() - startTime;
        resolve(elapsed >= timeoutMs ? timeoutMs : elapsed);
      });
    });
    
    req.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      console.log(`  Error: ${error.message} (after ${elapsed}ms)`);
      resolve(elapsed >= timeoutMs ? timeoutMs : elapsed);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(timeoutMs);
    });
    
    req.setTimeout(timeoutMs);
    req.write(requestBody);
    req.end();
  });
}

async function testBatchMeasurement() {
  console.log('🧪 Testing batch latency measurement...\n');
  
  // Test with some known public node IPs
  const testTargets = [
    '173.212.203.145', // Public node
    '173.212.220.65',  // Public node
    '1.2.3.4',         // Fake IP (will timeout)
  ];
  
  const proxyEndpoint = 'https://rpc1.pchednode.com/rpc';
  
  console.log('📡 Testing proxy latency...');
  const proxyLatency = await measureLatency(proxyEndpoint);
  console.log(`Proxy latency: ${proxyLatency}ms\n`);
  
  console.log('📡 Testing direct node endpoints...');
  const latencies = {};
  
  for (const target of testTargets) {
    const directEndpoint = `http://${target}:6000/rpc`;
    console.log(`\nTesting ${target}...`);
    
    const directLatency = await measureLatency(directEndpoint, 2000);
    
    if (directLatency !== null && directLatency < 2000) {
      latencies[target] = directLatency;
      console.log(`  ✅ Direct latency = ${directLatency}ms`);
    } else if (directLatency === 2000) {
      // Timeout - use proxy as fallback
      latencies[target] = proxyLatency || 2000;
      console.log(`  ⏱️  Direct timeout (2000ms), using proxy latency = ${latencies[target]}ms`);
    } else {
      latencies[target] = proxyLatency || 2000;
      console.log(`  ❌ Direct failed, using proxy latency = ${latencies[target]}ms`);
    }
  }
  
  console.log('\n📊 Results:');
  console.log(JSON.stringify(latencies, null, 2));
  
  return latencies;
}

// Run test
testBatchMeasurement().catch(console.error);

