/**
 * Extended check for data patterns - look at the actual values, not just counts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getDb } from '../lib/server/mongodb-nodes';

async function main() {
    console.log('🔍 Extended data analysis around 5:29 PM...\n');

    const db = await getDb();
    const collection = db.collection('node_history');

    // Check last 6 hours
    const now = Date.now();
    const sixHoursAgo = now - (6 * 60 * 60 * 1000);

    // Get all snapshots
    const snapshots = await collection.find({
        timestamp: { $gte: sixHoursAgo }
    }).sort({ timestamp: 1 }).toArray();

    console.log(`📊 Found ${snapshots.length} snapshots in last 6 hours\n`);

    // Track totals over time
    console.log('='.repeat(120));
    console.log('📈 AGGREGATE METRICS OVER TIME');
    console.log('='.repeat(120));
    console.log('Time       | Total Credits | Avg Packets Recv | Avg Packets Sent | Avg CPU | Avg RAM | Online Nodes');
    console.log('-'.repeat(120));

    for (const snapshot of snapshots) {
        const time = new Date(snapshot.timestamp).toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        });

        const nodeSnapshots = snapshot.nodeSnapshots || [];

        // Calculate total credits
        const totalCredits = nodeSnapshots.reduce((sum: number, n: { credits?: number }) =>
            sum + (n.credits || 0), 0);

        // Calculate avg packets
        const packetsNodes = nodeSnapshots.filter((n: { packetsReceived?: number }) =>
            n.packetsReceived !== undefined && n.packetsReceived > 0);
        const avgPacketsRecv = packetsNodes.length > 0
            ? packetsNodes.reduce((sum: number, n: { packetsReceived?: number }) => sum + (n.packetsReceived || 0), 0) / packetsNodes.length
            : 0;
        const avgPacketsSent = packetsNodes.length > 0
            ? packetsNodes.reduce((sum: number, n: { packetsSent?: number }) => sum + (n.packetsSent || 0), 0) / packetsNodes.length
            : 0;

        // Calculate avg CPU/RAM
        const resourceNodes = nodeSnapshots.filter((n: { cpuPercent?: number }) =>
            n.cpuPercent !== undefined && n.cpuPercent > 0);
        const avgCpu = resourceNodes.length > 0
            ? resourceNodes.reduce((sum: number, n: { cpuPercent?: number }) => sum + (n.cpuPercent || 0), 0) / resourceNodes.length
            : 0;
        const avgRam = resourceNodes.length > 0
            ? resourceNodes.reduce((sum: number, n: { ramPercent?: number }) => sum + (n.ramPercent || 0), 0) / resourceNodes.length
            : 0;

        const onlineNodes = nodeSnapshots.filter((n: { status?: string }) => n.status === 'online').length;

        console.log(`${time} | ${totalCredits.toLocaleString().padStart(13)} | ${Math.round(avgPacketsRecv).toLocaleString().padStart(16)} | ${Math.round(avgPacketsSent).toLocaleString().padStart(16)} | ${avgCpu.toFixed(2).padStart(7)}% | ${avgRam.toFixed(2).padStart(7)}% | ${onlineNodes}`);
    }

    // Check for patterns: What percentage of nodes have data?
    console.log('\n' + '='.repeat(100));
    console.log('📊 DATA COVERAGE BY NODE STATUS');
    console.log('='.repeat(100));

    // Get latest snapshot for detailed analysis
    const latestSnapshot = snapshots[snapshots.length - 1];
    if (latestSnapshot) {
        const nodes = latestSnapshot.nodeSnapshots || [];

        const online = nodes.filter((n: { status?: string }) => n.status === 'online');
        const offline = nodes.filter((n: { status?: string }) => n.status === 'offline');
        const syncing = nodes.filter((n: { status?: string }) => n.status === 'syncing');

        console.log(`\nLatest snapshot: ${new Date(latestSnapshot.timestamp).toISOString()}`);
        console.log(`Total: ${nodes.length} | Online: ${online.length} | Offline: ${offline.length} | Syncing: ${syncing.length}`);

        // Check data coverage per status
        const checkDataCoverage = (nodeList: any[], label: string) => {
            const withCredits = nodeList.filter((n: { credits?: number }) => n.credits !== undefined && n.credits > 0).length;
            const withPackets = nodeList.filter((n: { packetsReceived?: number }) => n.packetsReceived !== undefined && n.packetsReceived > 0).length;
            const withCpu = nodeList.filter((n: { cpuPercent?: number }) => n.cpuPercent !== undefined && n.cpuPercent > 0).length;
            const withRam = nodeList.filter((n: { ramPercent?: number }) => n.ramPercent !== undefined && n.ramPercent > 0).length;

            console.log(`\n${label} nodes (${nodeList.length}):`);
            console.log(`  Credits: ${withCredits}/${nodeList.length} (${nodeList.length > 0 ? Math.round(withCredits / nodeList.length * 100) : 0}%)`);
            console.log(`  Packets: ${withPackets}/${nodeList.length} (${nodeList.length > 0 ? Math.round(withPackets / nodeList.length * 100) : 0}%)`);
            console.log(`  CPU:     ${withCpu}/${nodeList.length} (${nodeList.length > 0 ? Math.round(withCpu / nodeList.length * 100) : 0}%)`);
            console.log(`  RAM:     ${withRam}/${nodeList.length} (${nodeList.length > 0 ? Math.round(withRam / nodeList.length * 100) : 0}%)`);
        };

        checkDataCoverage(online, 'ONLINE');
        checkDataCoverage(offline, 'OFFLINE');
        if (syncing.length > 0) checkDataCoverage(syncing, 'SYNCING');
    }

    // Look for the credit drop pattern
    console.log('\n' + '='.repeat(100));
    console.log('🔍 CREDIT VALUE CHANGES OVER TIME');
    console.log('='.repeat(100));

    let prevTotalCredits = 0;
    for (const snapshot of snapshots) {
        const time = new Date(snapshot.timestamp).toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        });

        const nodes = snapshot.nodeSnapshots || [];
        const totalCredits = nodes.reduce((sum: number, n: { credits?: number }) => sum + (n.credits || 0), 0);

        const change = totalCredits - prevTotalCredits;
        const changeIndicator = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        const changePercent = prevTotalCredits > 0 ? ((change / prevTotalCredits) * 100).toFixed(2) : 'N/A';

        if (Math.abs(change) > 1000 || prevTotalCredits === 0) {
            console.log(`${time} | Total: ${totalCredits.toLocaleString().padStart(15)} | Change: ${change.toLocaleString().padStart(15)} (${changePercent}%) ${changeIndicator}`);
        }

        prevTotalCredits = totalCredits;
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
