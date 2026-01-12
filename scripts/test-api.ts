
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testApi() {
    const port = 3000; // Assuming dev server is on 3000
    const baseUrl = `http://localhost:${port}/api`;

    try {
        console.log('Testing /api/pnodes?network=mainnet...');
        const res = await fetch(`${baseUrl}/pnodes?network=mainnet`);
        const data = await res.json();

        console.log('Status:', res.status);
        console.log('Total Nodes returned:', data.totalNodes);
        if (data.nodes && data.nodes.length > 0) {
            console.log('Sample node network:', data.nodes[0].network);
            console.log('Sample node pubkey:', data.nodes[0].pubkey);
        } else {
            console.log('NO NODES RETURNED');
        }

        console.log('\nTesting /api/pnodes?network=all...');
        const resAll = await fetch(`${baseUrl}/pnodes?network=all`);
        const dataAll = await resAll.json();
        const networkCounts = dataAll.nodes.reduce((acc: any, n: any) => {
            const net = n.network || 'unknown';
            acc[net] = (acc[net] || 0) + 1;
            return acc;
        }, {});
        console.log('Network counts in "all":', networkCounts);

    } catch (err) {
        console.error('API test failed. Is the dev server running?', err);
    }
}

testApi();
