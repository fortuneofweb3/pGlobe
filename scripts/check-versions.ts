#!/usr/bin/env npx tsx

/**
 * Script to check what versions are currently in the database
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getNodesCollection } from '../lib/server/mongodb-nodes';

async function checkVersions() {
  try {
    const collection = await getNodesCollection();
    
    // Get all nodes
    const nodes = await collection.find({}).toArray();
    
    console.log(`\n📊 Total nodes in database: ${nodes.length}\n`);
    
    // Count versions
    const versionMap = new Map<string, number>();
    nodes.forEach((node: any) => {
      const version = node.version || 'Unknown';
      versionMap.set(version, (versionMap.get(version) || 0) + 1);
    });
    
    // Sort by count
    const sortedVersions = Array.from(versionMap.entries())
      .map(([version, count]) => ({
        version,
        count,
        percentage: (count / nodes.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);
    
    console.log('📋 Version Distribution:\n');
    sortedVersions.forEach(({ version, count, percentage }) => {
      const isTrynet = version.includes('-trynet');
      const isTest = version.includes('-test') || version.includes('-dev');
      const marker = isTrynet ? ' [TRYNET]' : isTest ? ' [TEST/DEV]' : '';
      console.log(`  ${version.padEnd(25)} ${count.toString().padStart(4)} nodes (${percentage.toFixed(1)}%)${marker}`);
    });
    
    // Summary
    const trynetCount = sortedVersions.filter(v => v.version.includes('-trynet')).reduce((sum, v) => sum + v.count, 0);
    const stableCount = nodes.length - trynetCount;
    const stableVersions = sortedVersions.filter(v => !v.version.includes('-trynet') && v.version !== 'Unknown');
    
    console.log('\n📈 Summary:');
    console.log(`  Stable versions: ${stableCount} nodes (${((stableCount / nodes.length) * 100).toFixed(1)}%)`);
    console.log(`  Trynet versions: ${trynetCount} nodes (${((trynetCount / nodes.length) * 100).toFixed(1)}%)`);
    console.log(`  Unknown: ${versionMap.get('Unknown') || 0} nodes`);
    console.log(`\n  Unique stable versions: ${stableVersions.length}`);
    console.log(`  Unique trynet versions: ${sortedVersions.filter(v => v.version.includes('-trynet')).length}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkVersions();

