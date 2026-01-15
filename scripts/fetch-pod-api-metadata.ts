
import fetch from 'node-fetch';

async function main() {
    console.log('Fetching Pod Credits APIs...');

    // Mainnet
    try {
        const resp = await fetch('https://podcredits.xandeum.network/api/pods-credits');
        const data = await resp.json();
        console.log('\n=== MAINNET API FULL ITEM SAMPLE ===');
        if (data.pods_credits && data.pods_credits.length > 0) {
            console.log(JSON.stringify(data.pods_credits[0], null, 2));

            // Check if our target nodes are in there and if they have extra fields
            const targets = [
                'BN5wAsbo7PHTbQJVjkFu4bBA44jCbziLSjWHyiSHG4d3',
                '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc',
                '4oMLTALVEHN6W7gRsmQ2c4aiqWdAFTzt4mWQECb2d5UQ'
            ];

            targets.forEach(t => {
                const found = data.pods_credits.find((p: any) => p.pod_id === t);
                if (found) {
                    console.log(`\nFound Target ${t}:`, found);
                } else {
                    console.log(`\nTarget ${t} NOT found in API list.`);
                }
            });

        }
    } catch (e) {
        console.error('Error fetching Mainnet API:', e);
    }

    // Devnet
    try {
        const resp = await fetch('https://podcredits.xandeum.network/api/devnet-pod-credits');
        const data = await resp.json();
        console.log('\n=== DEVNET API FULL ITEM SAMPLE ===');
        if (data.pods_credits && data.pods_credits.length > 0) {
            console.log(JSON.stringify(data.pods_credits[0], null, 2));
        }
    } catch (e) {
        console.error('Error fetching Devnet API:', e);
    }
}

main();
