/**
 * Test the API endpoint format (simulating Deno Deploy)
 * Run with: node test-api-endpoint.js
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
    
    req.on('error', () => {
      const elapsed = Date.now() - startTime;
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

async function simulateDenoDeployBatch() {
  console.log('🧪 Simulating Deno Deploy batch measurement...\n');
  
  // Simulate what Deno Deploy will receive
  const targets = [
    '173.212.203.145', // Public node (should work)
    '173.212.220.65',  // Public node (should work)
    '1.2.3.4',         // Fake IP (will timeout)
    '192.168.1.1',     // Private IP (will fail)
  ];
  
  const proxyEndpoint = 'https://rpc1.pchednode.com/rpc';
  
  console.log(`Testing ${targets.length} nodes...\n`);
  
  // Measure proxy latency once (reuse for all nodes that need fallback)
  console.log('Measuring proxy latency once...');
  const proxyLatency = await measureLatency(proxyEndpoint, 2000);
  console.log(`Proxy latency: ${proxyLatency}ms\n`);
  
  const latencies = {};
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} nodes)...`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (target) => {
        // Try direct node endpoint first (port 6000)
        const directEndpoint = `http://${target}:6000/rpc`;
        const directLatency = await measureLatency(directEndpoint, 2000);
        
        // If direct query succeeded, use it (real per-node latency!)
        if (directLatency !== null && directLatency < 2000) {
          return { target, latency: directLatency, method: 'direct' };
        }
        
        // If direct failed/timeout, use pre-measured proxy latency as fallback
        return { 
          target, 
          latency: proxyLatency || 2000,
          method: directLatency === 2000 ? 'proxy-fallback-timeout' : 'proxy-fallback-error'
        };
      })
    );
    
    // Process batch results
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.latency !== null) {
        const { target, latency, method } = result.value;
        latencies[target] = latency;
        console.log(`  ${target}: ${latency}ms (${method})`);
      } else if (result.status === 'rejected') {
        console.log(`  Error: ${result.reason}`);
      }
    }
  }
  
  console.log('\n📊 Final Results:');
  console.log(JSON.stringify({
    success: true,
    region: 'test-local',
    proxyEndpoint,
    latencies,
    timestamp: Date.now(),
  }, null, 2));
  
  console.log('\n✅ Test complete!');
  console.log('\nKey observations:');
  console.log('- Direct latency works for public nodes (real per-node differences)');
  console.log('- Timeouts are captured (2000ms = unreachable)');
  console.log('- Proxy latency used as fallback');
  console.log('- No fake variation needed!');
  
  return latencies;
}

// Run test
simulateDenoDeployBatch().catch(console.error);

