import { Connection, PublicKey } from '@solana/web3.js';

async function queryRPC() {
  const RPC_URLS = [
    'https://rpc3.pchednode.com/rpc',
    'https://mainnet.helius-rpc.com/?api-key=2aca1e9b-9f51-44a0-938b-89dc6c23e9b4',
    'https://api.mainnet.xandeum.com'
  ];
  const PUBKEY = '7UNK4pm7zziAUz8XrnfxeS5z2P4aqyq6b6C2pWjMEWF9';
  
  console.log('--- RPC Investigation ---');
  
  for (const rpc of RPC_URLS) {
    console.log('Querying ' + rpc + ' for ' + PUBKEY + '...');
    
    try {
      const connection = new Connection(rpc, 'confirmed');
      const pubkey = new PublicKey(PUBKEY);
      
      // We'll just wait for the response, no manual timeout to keep it simple
      const accountInfo = await connection.getAccountInfo(pubkey);
      
      if (accountInfo) {
        console.log('SUCCESS on ' + rpc);
        console.log('Account Info:');
        console.log('  Lamports:', accountInfo.lamports);
        console.log('  Owner:', accountInfo.owner.toBase58());
        console.log('  Data length:', accountInfo.data.length);
        break; 
      } else {
        console.log('Account not found on-chain via ' + rpc);
      }
    } catch (err: any) {
      console.error('Error on ' + rpc + ':', err.message);
    }
  }
  
  console.log('--- Investigation Complete ---');
  process.exit(0);
}

queryRPC().catch(err => {
  console.error('CRITICAL ERROR:', err);
  process.exit(1);
});
