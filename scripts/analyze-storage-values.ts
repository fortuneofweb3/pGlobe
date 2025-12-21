/**
 * Analyze storage values in database to see if they're meaningful
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getAllNodes } from '../lib/server/mongodb-nodes';

async function main() {
  console.log('📊 Analyzing storage values...\n');
  
  const nodes = await getAllNodes();
  const nodesWithStorage = nodes.filter(n => 
    n.storageUsed !== undefined && 
    n.storageUsed !== null &&
    n.storageCapacity !== undefined &&
    n.storageCapacity !== null
  );
  
  console.log(`Total nodes: ${nodes.length}`);
  console.log(`Nodes with both storageUsed and storageCapacity: ${nodesWithStorage.length}\n`);
  
  if (nodesWithStorage.length === 0) {
    console.log('No nodes with storage data');
    return;
  }
  
  // Sort by storage usage percentage
  const withPercent = nodesWithStorage.map(n => ({
    pubkey: n.pubkey?.substring(0, 20) + '...',
    used: n.storageUsed!,
    capacity: n.storageCapacity!,
    percent: n.storageCapacity! > 0 ? (n.storageUsed! / n.storageCapacity!) * 100 : 0,
  })).sort((a, b) => b.percent - a.percent);
  
  console.log('Top 20 nodes by storage usage percentage:');
  console.log('Pubkey                    | Used (bytes)    | Capacity (bytes)     | Usage %');
  console.log('-'.repeat(85));
  withPercent.slice(0, 20).forEach(n => {
    const usedStr = n.used.toLocaleString().padEnd(15);
    const capStr = n.capacity.toLocaleString().padEnd(20);
    const pctStr = n.percent.toFixed(6) + '%';
    console.log(`${n.pubkey} | ${usedStr} | ${capStr} | ${pctStr}`);
  });
  
  console.log('\nStatistics:');
  const percents = withPercent.map(n => n.percent);
  const maxPercent = Math.max(...percents);
  const minPercent = Math.min(...percents);
  const avgPercent = percents.reduce((a, b) => a + b, 0) / percents.length;
  const medianPercent = percents.sort((a, b) => a - b)[Math.floor(percents.length / 2)];
  
  console.log(`  Max usage: ${maxPercent.toFixed(6)}%`);
  console.log(`  Min usage: ${minPercent.toFixed(6)}%`);
  console.log(`  Avg usage: ${avgPercent.toFixed(6)}%`);
  console.log(`  Median usage: ${medianPercent.toFixed(6)}%`);
  
  const significantUsage = withPercent.filter(n => n.percent > 0.1); // > 0.1%
  console.log(`\nNodes with > 0.1% usage: ${significantUsage.length}/${nodesWithStorage.length}`);
  
  const meaningfulUsage = withPercent.filter(n => n.percent > 1); // > 1%
  console.log(`Nodes with > 1% usage: ${meaningfulUsage.length}/${nodesWithStorage.length}`);
  
  // Check if storageUsed equals storageCommitted (might indicate it's just metadata)
  const nodesWithCommitted = nodes.filter(n => 
    n.storageUsed !== undefined && 
    n.storageCommitted !== undefined &&
    n.storageUsed === n.storageCommitted
  );
  console.log(`\nNodes where storageUsed === storageCommitted: ${nodesWithCommitted.length}`);
  
  if (nodesWithCommitted.length > 0) {
    console.log('  ⚠️  This suggests storage_used might just be metadata/overhead, not actual data storage');
  }
  
  // Check distribution of storage values
  const storageValues = nodesWithStorage.map(n => n.storageUsed!);
  const uniqueValues = new Set(storageValues);
  console.log(`\nUnique storage_used values: ${uniqueValues.size}`);
  
  if (uniqueValues.size < 20) {
    console.log('  ⚠️  Very few unique values - suggests these might be default/metadata values');
    console.log('  Values:', Array.from(uniqueValues).sort((a, b) => a - b).slice(0, 20).join(', '));
  }
  
  // Check if values are suspiciously similar
  const commonValues = new Map<number, number>();
  storageValues.forEach(v => {
    commonValues.set(v, (commonValues.get(v) || 0) + 1);
  });
  
  const topValues = Array.from(commonValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (topValues.length > 0 && topValues[0][1] > nodesWithStorage.length * 0.1) {
    console.log('\n  ⚠️  Most common storage values:');
    topValues.forEach(([value, count]) => {
      console.log(`    ${value} bytes: ${count} nodes (${((count / nodesWithStorage.length) * 100).toFixed(1)}%)`);
    });
    console.log('  This suggests storage_used might be a default/metadata value, not actual usage');
  }
  
  console.log('\n=== CONCLUSION ===');
  if (maxPercent < 0.0001) {
    console.log('❌ Storage usage is negligible (< 0.0001% for all nodes)');
    console.log('   Storage tracking is probably not meaningful for pNodes');
  } else if (meaningfulUsage.length === 0) {
    console.log('⚠️  Storage usage is minimal (< 1% for all nodes)');
    console.log('   Storage might just be metadata/overhead, not actual data storage');
  } else {
    console.log('✅ Some nodes have meaningful storage usage');
  }
}

main().catch(console.error).finally(() => process.exit(0));



