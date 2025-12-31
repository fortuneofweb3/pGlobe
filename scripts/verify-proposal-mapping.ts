
import { getProposalMapping } from '../lib/server/proposal-scanner';

async function verify() {
    console.log('Fetching proposal mapping...');
    const mapping = await getProposalMapping();

    // Check for some known recipients from the proposal I inspected earlier
    const knownRecipients = [
        'GfqAkS8ZkxLZ9TFUYM6pTJstneYcsZmdTmJmEZvj91oY',
        '9xXYjZ5e5v3g6zUmYm8RanQEJLxRCUPc6x72ERBLXqPc',
        '8a3tTYsJ3NvMxhKTd48x2o7XFZDQjSoQR796WVxDaL1G',
        '5T1kqHzi9K7gHJYTaAWYcoseTKWCf2SHaF41XcqFZwFh'
    ];

    console.log('\nVerifying known mapping entries:');
    for (const recipient of knownRecipients) {
        // Based on my manual check, the amount was 30000
        const key = `${recipient}:30000`;
        const proposalId = mapping.get(key);
        console.log(`${recipient}: ${proposalId || 'NOT FOUND'}`);
    }

    console.log('\nTotal mapping size:', mapping.size);

    if (mapping.size > 0) {
        console.log('\nVerification successful: Mapping contains data!');
    } else {
        console.log('\nVerification failed: Mapping is empty.');
    }
}

verify().catch(console.error);
