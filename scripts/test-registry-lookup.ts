
import { getManagerForNode } from '../lib/server/registry';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testLookup() {
    // Known node from previous logs/CSV
    // Pubkey: Hj5owPSHVAxbcvDSrukN4MtLf4Sw34uskyXMdBtTUfTu
    // Expect Manager: 68jGBZsX3LwZWKwMmi2feZNvMDeANRMwsHAHQRHN5YJP
    const targetNode = 'Hj5owPSHVAxbcvDSrukN4MtLf4Sw34uskyXMdBtTUfTu';

    console.log(`Testing lookup for Node: ${targetNode}`);
    const result = await getManagerForNode(targetNode);

    console.log('Result:', result);

    if (result === '68jGBZsX3LwZWKwMmi2feZNvMDeANRMwsHAHQRHN5YJP') {
        console.log('✅ SUCCESS: Manager matches expected value.');
    } else {
        console.log('❌ FAILURE: Manager mismatch or not found.');
    }

    process.exit(0);
}

testLookup().catch(console.error);
