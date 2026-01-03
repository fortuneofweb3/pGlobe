const { Connection, PublicKey } = require('@solana/web3.js');

async function queryRPC() {
  const RPC_URLS = [
    'https://rpc3.pchednode.com/rpc',
    'https://mainnet.helius-rpc.com/?api-key=2aca1e9b-9f51-44a0-938b-89dc6c23e9b4',
    'https://api.mainnet.xandeum.com'
  ];
  const PUBKEY = '7UNK4pm7zziAUz8XrnfxeS5z2P4aqyq6b6C2pWjMEWF9';
  
  for (const rpc of RPC_URLS) {
    console.log(`Querying ${rpc} for ${PUBKEY}...`);
    
    try {
      const connection = new Connection(rpc, { commitment: 'confirmed' });
      const pubkey = new PublicKey(PUBKEY);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const accountInfo = await connection.getAccountInfo(pubkey, { signal: controller.signal }).catch(err => {
          if (err.name === 'AbortError') throw new Error('Query timed out');
          throw err;
      });
      
      clearTimeout(timeoutId);
      
      if (accountInfo) {
        console.log('Account Info found:');
        console.log('  Lamports:', accountInfo.lamports);
        console.log('  Owner:', accountInfo.owner.toBase58());
        console.log('  Executable:', accountInfo.executable);
        console.log('  Data length:', accountInfo.data.length);
        console.log('  SUCCESS on ' + rpc);
        break; // Stop after first success
      } else {
        console.log('Account not found on ' + rpc);
      }
    } catch (err) {
      console.error('Error on ' + rpc + ':', err.message);
    }
  }
  
  process.exit(0);
}

queryRPC();
