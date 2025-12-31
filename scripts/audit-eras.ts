import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_PROGRAM = new PublicKey('6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL');
const DEVNET_RPC = 'https://api.devnet.xandeum.com:8899';
const INDEX_ACCOUNT = new PublicKey('GHTUesiECzPRHTShmBGt9LiaA89T8VAzw8ZWNE6EvZRs');

async function run() {
    const conn = new Connection(DEVNET_RPC);
    const acc = await conn.getAccountInfo(INDEX_ACCOUNT);
    if (!acc) return;
    
    const nodes: string[] = [];
    for (let i = 0; i < acc.data.length; i += 32) {
        if (i+32 > acc.data.length) break;
        const pk = new PublicKey(acc.data.slice(i, i+32));
        if (pk.toBase58() !== '11111111111111111111111111111111') nodes.push(pk.toBase58());
    }
    
    console.log(`Auditing ${nodes.length} nodes...`);
    
    const stats = {
        hasManager: 0,
        noManager: 0,
        regEra1: 0,
        regEraOther: 0,
        manEraDist: {} as Record<number, number>
    };

    const targetNode = 'HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC';

    for (let i = 0; i < nodes.length; i += 50) {
        const batch = nodes.slice(i, i + 50);
        const regAddrs = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('registry'), new PublicKey(pk).toBuffer()], DEVNET_PROGRAM)[0]);
        const manAddrs = batch.map(pk => PublicKey.findProgramAddressSync([Buffer.from('manager'), new PublicKey(pk).toBuffer()], DEVNET_PROGRAM)[0]);
        
        const [regAccs, manAccs] = await Promise.all([
            conn.getMultipleAccountsInfo(regAddrs),
            conn.getMultipleAccountsInfo(manAddrs)
        ]);
        
        regAccs.forEach((r, idx) => {
            if (!r) return;
            const regEra = r.data.readUInt16LE(32);
            if (regEra === 1) stats.regEra1++; else stats.regEraOther++;
            
            const m = manAccs[idx];
            if (m) {
                stats.hasManager++;
                const mEra = m.data.readUInt16LE(32);
                stats.manEraDist[mEra] = (stats.manEraDist[mEra] || 0) + 1;
            } else {
                stats.noManager++;
            }

            if (batch[idx] === targetNode) {
                console.log(`\nTARGET NODE AUDIT: ${targetNode}`);
                console.log(`  Registry Era: ${regEra}`);
                console.log(`  Has Manager PDA: ${!!m}`);
            }
        });
    }

    console.log('\n=== AUDIT RESULTS ===');
    console.log('Registry Era 1:', stats.regEra1);
    console.log('Registry Era Other:', stats.regEraOther);
    console.log('Nodes with Manager PDA:', stats.hasManager);
    console.log('Nodes WITHOUT Manager PDA:', stats.noManager);
    console.log('Manager Era Distribution:', stats.manEraDist);
}
run().catch(console.error);
