/**
 * Self-hosted measurement server for multi-region latency
 * Deploy this to VPS in different regions
 * 
 * Usage:
 * 1. Install: npm install express
 * 2. Run: node measurement-server.js
 * 3. Access: http://your-vps-ip:3000/measure-batch
 */

const express = require('express');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

async function measureLatency(target, timeoutMs = 2000) {
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
    
    return Date.now() - startTime;
  } catch (error) {
    // Even on timeout/error, capture the elapsed time
    const elapsed = Date.now() - startTime;
    
    // If it's a timeout, return the timeout duration (useful info!)
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return timeoutMs; // Return timeout duration as latency
    }
    
    // For other errors, return elapsed time (how long until error)
    return elapsed >= timeoutMs ? timeoutMs : elapsed;
  }
}

// Batch measurement endpoint
app.post('/measure-batch', async (req, res) => {
  try {
    const { targets, proxyEndpoint } = req.body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: targets must be a non-empty array',
      });
    }
    
    const proxy = proxyEndpoint || 'https://rpc1.pchednode.com/rpc';
    
    // Measure proxy latency once (reuse for all nodes that need fallback)
    const proxyLatency = await measureLatency(proxy, 2000);
    
    // Measure latency for each node individually
    // Try direct node endpoint first, fallback to proxy latency
    const latencies = {};
    
    // Measure each node individually (in parallel batches)
    const BATCH_SIZE = 50;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (target) => {
          // Try direct node endpoint first (port 6000)
          const directEndpoint = `http://${target}:6000/rpc`;
          const directLatency = await measureLatency(directEndpoint, 2000);
          
          // If direct query succeeded, use it (real per-node latency!)
          if (directLatency !== null && directLatency < 2000) {
            return { target, latency: directLatency };
          }
          
          // If direct failed/timeout, use proxy latency as fallback
          return { 
            target, 
            latency: proxyLatency || 2000
          };
        })
      );
      
      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.latency !== null) {
          latencies[result.value.target] = result.value.latency;
        }
      }
    }
    
    res.json({
      success: true,
      region: process.env.REGION || 'unknown',
      proxyEndpoint: proxy,
      latencies,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    region: process.env.REGION || 'unknown',
    timestamp: Date.now(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Measurement server running on port ${PORT}`);
  console.log(`Region: ${process.env.REGION || 'unknown'}`);
});

