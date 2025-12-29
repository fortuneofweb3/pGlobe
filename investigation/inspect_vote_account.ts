
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.xandeum.com:8899/';
const TEST_NODE_PUBKEY = 'EcTqXgB6VJStAtBZAXcjLHf5ULj41H1PFZQ17zKosbhL';

async function inspectVoteAccount() {
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log(`Checking Vote Accounts for Node: ${TEST_NODE_PUBKEY}`);

    const voteAccounts = await connection.getVoteAccounts();
    const nodeVote = voteAccounts.current.concat(voteAccounts.delinquent).find(
        v => v.nodePubkey === TEST_NODE_PUBKEY
    );

    if (!nodeVote) {
        console.log('No Vote Account found for this node.');
        return;
    }

    console.log('Vote Account Found!');
    console.log('Vote Pubkey:', nodeVote.votePubkey);
    console.log('Node Pubkey:', nodeVote.nodePubkey);

    // Convert Vote Pubkey string to PublicKey to fetch details
    const votePubkey = new PublicKey(nodeVote.votePubkey);
    const accountInfo = await connection.getAccountInfo(votePubkey);

    // Authorized Withdrawer is usually at offset 36..68 (after version(4), node(32))? 
    // Actually Vote State Layout:
    // 0-4: Version
    // 4-36: Node Pubkey
    // 36-68: Authorized Withdrawer
    // 68-100: Commission
    // ...

    if (accountInfo) {
        console.log(`Data Length: ${accountInfo.data.length}`);
        const withdrawer = new PublicKey(accountInfo.data.slice(36, 68));
        console.log(`Authorized Withdrawer (Offset 36): ${withdrawer.toBase58()}`);
    }
}

inspectVoteAccount().catch(console.error);
