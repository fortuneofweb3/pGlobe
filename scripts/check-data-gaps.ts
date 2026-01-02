/**
 * Check for data gaps in node_history collection around a specific time
 * Investigates if credit history, resources, and packets rate data stopped/started
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    console.log('🔍 Checking for data gaps in node_history...\n');

    const db = await getDb();
    const collection = db.collection('node_history');

    // Get current time and search around 5:29 PM today (West Africa Time is +1)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 5:29 PM WAT = 4:29 PM UTC = 16:29 UTC
    // Let's check 4 hours around that time (3:00 PM to 7:00 PM WAT)
    const startCheck = new Date(today);
    startCheck.setUTCHours(14, 0, 0, 0); // 3:00 PM WAT = 2:00 PM UTC

    const endCheck = new Date(today);
    endCheck.setUTCHours(18, 0, 0, 0); // 7:00 PM WAT = 6:00 PM UTC

    console.log(`📅 Checking time range: ${startCheck.toISOString()} to ${endCheck.toISOString()}`);
    console.log(`   (Local: ~3:00 PM to 7:00 PM WAT)\n`);

    // Get all snapshots in this time range
    const snapshots = await collection.find({
        timestamp: {
            $gte: startCheck.getTime(),
            $lte: endCheck.getTime()
        }
    }).sort({ timestamp: 1 }).toArray();

    console.log(`📊 Found ${snapshots.length} snapshots in this time range\n`);

    if (snapshots.length === 0) {
        console.log('❌ No snapshots found! Data collection may have stopped.\n');

        // Get the most recent snapshot overall
        const lastSnapshot = await collection.findOne({}, { sort: { timestamp: -1 } });
        if (lastSnapshot) {
            console.log(`📌 Last snapshot was at: ${new Date(lastSnapshot.timestamp).toISOString()}`);
            console.log(`   Interval: ${lastSnapshot.interval}`);
        }

        process.exit(0);
        return;
    }

    console.log('='.repeat(80));
    console.log('📈 SNAPSHOT TIMELINE (checking for gaps)');
    console.log('='.repeat(80));

    let prevTimestamp: number | null = null;
    let gapCount = 0;

    for (const snapshot of snapshots) {
        const time = new Date(snapshot.timestamp);
        const localTime = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

        // Check node snapshot data quality
        const nodeSnapshots = snapshot.nodeSnapshots || [];
        const totalNodes = nodeSnapshots.length;

        // Check credits data
        const nodesWithCredits = nodeSnapshots.filter((n: { credits?: number }) =>
            n.credits !== undefined && n.credits !== null && n.credits > 0
        ).length;

        // Check packets data
        const nodesWithPackets = nodeSnapshots.filter((n: { packetsReceived?: number; packetsSent?: number }) =>
            (n.packetsReceived !== undefined && n.packetsReceived > 0) ||
            (n.packetsSent !== undefined && n.packetsSent > 0)
        ).length;

        // Check CPU/RAM data
        const nodesWithResources = nodeSnapshots.filter((n: { cpuPercent?: number; ramPercent?: number }) =>
            (n.cpuPercent !== undefined && n.cpuPercent > 0) ||
            (n.ramPercent !== undefined && n.ramPercent > 0)
        ).length;

        // Check for gap from previous snapshot
        let gap = '';
        if (prevTimestamp) {
            const gapMinutes = (snapshot.timestamp - prevTimestamp) / (1000 * 60);
            if (gapMinutes > 15) { // More than 15 minutes is a gap
                gap = ` ⚠️ GAP: ${Math.round(gapMinutes)} min since last`;
                gapCount++;
            }
        }

        // Determine if there's missing data
        const creditsPercent = totalNodes > 0 ? Math.round((nodesWithCredits / totalNodes) * 100) : 0;
        const packetsPercent = totalNodes > 0 ? Math.round((nodesWithPackets / totalNodes) * 100) : 0;
        const resourcesPercent = totalNodes > 0 ? Math.round((nodesWithResources / totalNodes) * 100) : 0;

        const missingIndicators = [];
        if (creditsPercent < 50) missingIndicators.push(`Credits: ${creditsPercent}%`);
        if (packetsPercent < 50) missingIndicators.push(`Packets: ${packetsPercent}%`);
        if (resourcesPercent < 50) missingIndicators.push(`Resources: ${resourcesPercent}%`);

        const status = missingIndicators.length > 0
            ? `❌ Low data: ${missingIndicators.join(', ')}`
            : `✅ OK`;

        console.log(`${localTime} | ${snapshot.interval} | Nodes: ${totalNodes} | Credits: ${nodesWithCredits}/${totalNodes} (${creditsPercent}%) | Packets: ${nodesWithPackets}/${totalNodes} (${packetsPercent}%) | Resources: ${nodesWithResources}/${totalNodes} (${resourcesPercent}%) | ${status}${gap}`);

        prevTimestamp = snapshot.timestamp;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total snapshots analyzed: ${snapshots.length}`);
    console.log(`Gaps detected (>15 min): ${gapCount}`);

    // Sample a specific node to see data continuity
    if (snapshots.length > 0 && snapshots[0].nodeSnapshots?.length > 0) {
        const samplePubkey = snapshots[0].nodeSnapshots[0].pubkey;
        console.log(`\n📌 Sample node tracking: ${samplePubkey.slice(0, 8)}...`);

        for (const snapshot of snapshots) {
            const nodeData = snapshot.nodeSnapshots?.find((n: { pubkey: string }) => n.pubkey === samplePubkey);
            if (nodeData) {
                const time = new Date(snapshot.timestamp).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
                console.log(`  ${time} | Credits: ${nodeData.credits ?? 'N/A'} | Packets: ${nodeData.packetsReceived ?? 'N/A'}/${nodeData.packetsSent ?? 'N/A'} | CPU: ${nodeData.cpuPercent ?? 'N/A'}% | RAM: ${nodeData.ramPercent ?? 'N/A'}%`);
            }
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
