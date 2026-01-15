
import axios from 'axios';

const BASE_URL = 'https://podcredits.xandeum.network/api';
const TARGET = '6Rq5FZMiLc5Fwfo89gbRjhZniY17gX88SpKyU83YKwRc'; // Ghost Node with most credits

const PATTERNS = [
    `/pod/${TARGET}`,
    `/node/${TARGET}`,
    `/credits/${TARGET}`,
    `/stats/${TARGET}`,
    `/pods/${TARGET}`,
    `/nodes/${TARGET}`,
    `/pod-credits/${TARGET}`,
    `/pnode/${TARGET}`,
    `/admin/pod/${TARGET}`,
    `/internal/pod/${TARGET}`,
    `/details?pubkey=${TARGET}`,
    `/info?pubkey=${TARGET}`,
    `/mainnet/pod/${TARGET}`
];

async function fuzz() {
    console.log(`Fuzzing ${BASE_URL} for target ${TARGET}...`);

    for (const path of PATTERNS) {
        const url = `${BASE_URL}${path}`;
        process.stdout.write(`Trying ${url}... `);
        try {
            const resp = await axios.get(url, { timeout: 3000, validateStatus: () => true });
            console.log(`[${resp.status}]`);
            if (resp.status === 200) {
                console.log('>>> SUCCESS! Data:', JSON.stringify(resp.data).slice(0, 200));
            }
        } catch (e: any) {
            console.log(`ERROR (${e.message})`);
        }
    }
}

fuzz();
