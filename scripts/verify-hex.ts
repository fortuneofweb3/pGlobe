
import { PublicKey } from '@solana/web3.js';

// Hex from debug-era for Node GCoCP...
// Offset 0: e1e4ed522e5c3a28460f6131d701be67
// Offset 16: 4ba7dd0af0437bd707d184354a4b99a3
// Offset 32: 01000128ff6700000000a2ac76776028
// Offset 48: 9b57cd45b14df3766ba457da6a85c6a3
// Offset 64: fad08a515b85e0497ec1000000000000
const dumpHex = 'e1e4ed522e5c3a28460f6131d701be674ba7dd0af0437bd707d184354a4b99a301000128ff6700000000a2ac767760289b57cd45b14df3766ba457da6a85c6a3fad08a515b85e0497ec1000000000000';

const managerStr = 'Bx1aHrYYhrqKAHkJZE7qrbEBHX43LBKgsy3aBwu2h1Zr';
const manager = new PublicKey(managerStr);
const managerHex = manager.toBuffer().toString('hex');

console.log('Searching for Manager:', managerHex);

const index = dumpHex.indexOf(managerHex);
if (index !== -1) {
    // index is in nibbles (2 per byte)
    // Offset in bytes = index / 2
    console.log(`FOUND! Manager starts at nibble ${index}, byte offset ${index / 2}`);
} else {
    console.log('Manager NOT found in the first 80 bytes of dump.');

    // Check overlapping or check full dump if we had it
    // Let's print the hex we have
    console.log('Dump:', dumpHex);
}
