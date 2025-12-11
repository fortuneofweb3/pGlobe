/**
 * Local test script for latency measurement
 * Run with: deno run --allow-net test-latency-local.ts
 */

async function measureLatency(target: string, timeoutMs: number = 2000): Promise<number | null> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-version',
        id: 1,
        params: [],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    
    const latency = Date.now() - startTime;
    console.log(`✅ ${target}: ${latency}ms`);
    return latency;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.log(`⏱️  ${target}: TIMEOUT (${timeoutMs}ms)`);
      return timeoutMs;
    }
    
    console.log(`❌ ${target}: ERROR after ${elapsed}ms - ${error.message}`);
    return elapsed >= timeoutMs ? timeoutMs : elapsed;
  }
}

async function testBatchMeasurement() {
  console.log('🧪 Testing batch latency measurement...\n');
  
  // Test with some known public node IPs
  const testTargets = [
    '173.212.203.145', // Public node
    '173.212.220.65',  // Public node
    '1.2.3.4',         // Fake IP (will timeout)
    '192.168.1.1',     // Private IP (will fail)
  ];
  
  const proxyEndpoint = 'https://rpc1.pchednode.com/rpc';
  
  console.log('📡 Testing proxy latency...');
  const proxyLatency = await measureLatency(proxyEndpoint);
  console.log(`Proxy latency: ${proxyLatency}ms\n`);
  
  console.log('📡 Testing direct node endpoints...');
  const latencies: Record<string, number> = {};
  
  for (const target of testTargets) {
    const directEndpoint = `http://${target}:6000/rpc`;
    const directLatency = await measureLatency(directEndpoint, 2000);
    
    if (directLatency !== null && directLatency < 2000) {
      latencies[target] = directLatency;
      console.log(`  ✅ ${target}: Direct latency = ${directLatency}ms`);
    } else if (directLatency === 2000) {
      // Timeout - use proxy as fallback
      latencies[target] = proxyLatency || 2000;
      console.log(`  ⏱️  ${target}: Direct timeout, using proxy latency = ${latencies[target]}ms`);
    } else {
      latencies[target] = proxyLatency || 2000;
      console.log(`  ❌ ${target}: Direct failed, using proxy latency = ${latencies[target]}ms`);
    }
  }
  
  console.log('\n📊 Results:');
  console.log(JSON.stringify(latencies, null, 2));
  
  return latencies;
}

// Run test
testBatchMeasurement().catch(console.error);

