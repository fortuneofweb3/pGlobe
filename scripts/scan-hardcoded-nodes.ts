
import axios from 'axios';

const GHOST_NODES = new Set([
    'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
    '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
    '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
]);

const DIRECT_PRPC_ENDPOINTS = [
    '89.123.115.81:6000',
    '173.212.203.145:6000',
    '173.212.220.65:6000',
    '161.97.97.41:6000',
    '192.190.136.36:6000',
    '192.190.136.37:6000',
    '192.190.136.38:6000',
    '192.190.136.28:6000',
    '192.190.136.29:6000',
    '207.244.255.1:6000',
    '173.249.59.66:6000',
    '173.249.54.191:6000',
    '84.21.171.111:6000',
    '152.53.236.91:6000',
];

async function scan() {
    console.log(`Scanning ${DIRECT_PRPC_ENDPOINTS.length} hardcoded endpoints...`);

    for (const endpoint of DIRECT_PRPC_ENDPOINTS) {
        const url = `http://${endpoint}/rpc`;
        process.stdout.write(`Checking ${endpoint}... `);

        try {

            // 2. Try 'get-pods-with-stats' which returns the neighbors AND self
            const podsResp = await axios.post(url, {
                jsonrpc: '2.0',
                method: 'get-pods-with-stats',
                id: 1,
                params: []
            }, { timeout: 3000 }).catch(() => null);

            let pods = podsResp?.data?.result?.pods || podsResp?.data?.result || [];

            // If empty, try 'get-pods'
            if (!pods.length) {
                const podsResp2 = await axios.post(url, {
                    jsonrpc: '2.0',
                    method: 'get-pods',
                    id: 1,
                    params: []
                }, { timeout: 3000 }).catch(() => null);
                pods = podsResp2?.data?.result?.pods || podsResp2?.data?.result || [];
            }

            if (pods.length) {
                console.log(`ALIVE -> Returned ${pods.length} peers`);

                // Search specifically for GHOST NODES in this list
                for (const pod of pods) {
                    const pk = pod.pubkey || pod.publicKey;
                    if (GHOST_NODES.has(pk)) {
                        console.log(`\n🚨 🚨 🚨 MATCH FOUND in Peer List of ${endpoint}! 🚨 🚨 🚨`);
                        console.log(`Ghost Node Pubkey: ${pk}`);
                        console.log(`Ghost Node IP: ${pod.address || 'Unknown'}`);
                        console.log(`Stats:`, pod);
                        console.log(`🚨 🚨 🚨 ---------------- 🚨 🚨 🚨\n`);
                    }
                }

                // Also check if any of these hardcoded nodes IS the ghost node
                // (Usually the first one or marked with some flag, but checking all addresses is safer)
                // If the pod.address matches the endpoint IP, that IS the node.
                for (const pod of pods) {
                    // specific check if the pod address matches the endpoint we are scanning
                    if (pod.address && pod.address.includes(endpoint.split(':')[0])) {
                        const pk = pod.pubkey || pod.publicKey;
                        if (GHOST_NODES.has(pk)) {
                            console.log(`\n🚨 🚨 🚨 HARDCODED NODE IS GHOST NODE! 🚨 🚨 🚨`);
                            console.log(`Endpoint: ${endpoint}`);
                            console.log(`Pubkey: ${pk}`);
                            console.log(`🚨 🚨 🚨 ---------------- 🚨 🚨 🚨\n`);
                        }
                    }
                }

            } else {
                console.log(`ALIVE (No Pods returned)`);
            }

        } catch (e: any) {
            console.log(`DEAD (${e.message})`);
        }
    }
}

scan();
