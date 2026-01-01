
import dotenv from 'dotenv';
import path from 'path';
import * as http from 'http';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function httpPost(url: string, data: object, timeoutMs: number = 30000): Promise<any> {
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
                        resolve({ error: 'Parse error', raw: responseData.slice(0, 100) });
                    }
                });
            });

            req.on('error', (e: any) => resolve({ error: e.message }));
            req.on('timeout', () => { req.destroy(); resolve({ error: 'Timeout' }); });
            req.write(postData);
            req.end();
        } catch (e: any) {
            resolve({ error: e.message });
        }
    });
}

const ENDPOINTS = [
    '89.123.115.81:6000',
    '173.212.203.145:6000',
    '173.212.220.65:6000',
    '192.190.136.36:6000',
    '192.190.136.37:6000',
    '192.190.136.38:6000',
    '207.244.255.1:6000',
    '173.249.59.66:6000',
    '173.249.54.191:6000',
    '84.21.171.111:6000',
    '152.53.236.91:6000',
];

async function checkRaw() {
    console.log('--- RAW GOSSIP DUMP ---');

    const allPubkeys = new Set<string>();
    const results = [];

    for (const ep of ENDPOINTS) {
        console.log(`Checking ${ep}...`);
        const url = `http://${ep}/rpc`;
        const response = await httpPost(url, { jsonrpc: '2.0', method: 'get-pods-with-stats', id: 1 });

        if (response.result && response.result.pods) {
            const pods = response.result.pods;
            const validPods = pods.filter((p: any) => p.pubkey || p.publicKey);
            const uniqueInEp = new Set(validPods.map((p: any) => p.pubkey || p.publicKey)).size;

            console.log(`  - Total pods: ${pods.length}`);
            console.log(`  - Valid pubkeys: ${validPods.length}`);
            console.log(`  - Unique pubkeys in this endpoint: ${uniqueInEp}`);

            validPods.forEach((p: any) => allPubkeys.add(p.pubkey || p.publicKey));

            results.push({
                endpoint: ep,
                total: pods.length,
                valid: validPods.length,
                unique: uniqueInEp
            });
        } else {
            console.log(`  - Error or no pods: ${JSON.stringify(response).slice(0, 100)}`);
        }
    }

    console.log('\n--- SUMMARY ---');
    console.log(`Total unique pubkeys across ALL endpoints: ${allPubkeys.size}`);

    process.exit(0);
}

checkRaw();
