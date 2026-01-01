
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

async function analyzeDuplicates() {
    const ep = '89.123.115.81:6000';
    console.log(`Analyzing duplicates from ${ep}...`);

    const response = await httpPost(`http://${ep}/rpc`, { jsonrpc: '2.0', method: 'get-pods-with-stats', id: 1 });

    if (!response.result || !response.result.pods) {
        console.error('Failed to get pods');
        return;
    }

    const pods = response.result.pods;
    const byPubkey = new Map<string, any[]>();

    pods.forEach((p: any) => {
        const pk = p.pubkey || p.publicKey;
        if (pk) {
            if (!byPubkey.has(pk)) byPubkey.set(pk, []);
            byPubkey.get(pk)!.push(p);
        }
    });

    const duplicates = Array.from(byPubkey.entries()).filter(([pk, list]) => list.length > 1);

    console.log(`\nFound ${duplicates.length} duplicate pubkeys (appearing in multiple pod records)`);

    duplicates.slice(0, 10).forEach(([pk, list]) => {
        console.log(`\nPubkey: ${pk}`);
        list.forEach((p, i) => {
            console.log(`  [${i}] Address: ${p.address}, Version: ${p.version}, LastSeen: ${p.last_seen_timestamp}`);
        });
    });

    // Version breakdown on RAW items
    const rawVersions: Record<string, number> = {};
    pods.forEach((p: any) => {
        const v = p.version || 'unknown';
        rawVersions[v] = (rawVersions[v] || 0) + 1;
    });

    console.log('\n--- RAW VERSION BREAKDOWN (Before Deduplication) ---');
    Object.entries(rawVersions).sort().forEach(([v, count]) => {
        console.log(` ${v}: ${count}`);
    });

    console.log('\n--- UNIQUE VERSION BREAKDOWN (After Deduplication) ---');
    const uniqueVersions: Record<string, number> = {};
    byPubkey.forEach((list, pk) => {
        // Take the first one for simplicity
        const v = list[0].version || 'unknown';
        uniqueVersions[v] = (uniqueVersions[v] || 0) + 1;
    });
    Object.entries(uniqueVersions).sort().forEach(([v, count]) => {
        console.log(` ${v}: ${count}`);
    });

    console.log('\nTotal RAW items:', pods.length);
    console.log('Total UNIQUE pubkeys:', byPubkey.size);

    process.exit(0);
}

analyzeDuplicates();
