import { getAllNodes } from './lib/server/mongodb-nodes';

async function findMainnetNode() {
  try {
    const nodes = await getAllNodes('mainnet');
    const mainnetOnly = nodes.filter(n => n.network === 'mainnet');
    console.log('Found ' + mainnetOnly.length + ' mainnet-only nodes');
    if (mainnetOnly.length > 0) {
      console.log('Example Node:');
      console.log(JSON.stringify(mainnetOnly[0], null, 2));
    } else {
      console.log('No mainnet-only nodes found in database.');
      console.log('Total mainnet-affiliated nodes: ' + nodes.length);
      if (nodes.length > 0) {
          console.log('Example Mainnet-affiliated Node:');
          console.log(JSON.stringify(nodes[0], null, 2));
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

findMainnetNode();
