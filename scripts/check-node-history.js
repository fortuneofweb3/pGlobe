#!/usr/bin/env node

/**
 * Check which nodes have historical data and which don't
 */

import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set');
  process.exit(1);
}

async function checkNodeHistory() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('pGlobe');
    
    // Get all current nodes
    const nodesCollection = db.collection('pNodes');
    const allNodes = await nodesCollection.find({}).toArray();
    console.log(`\n📊 Total nodes in database: ${allNodes.length}`);
    
    // Get historical snapshots collection
    const historyCollection = db.collection('historicalSnapshots');
    const totalSnapshots = await historyCollection.countDocuments();
    console.log(`📊 Total historical snapshots: ${totalSnapshots}`);
    
    if (totalSnapshots === 0) {
      console.log('\n❌ No historical snapshots found! Background refresh might not be storing them.');
      return;
    }
    
    // Get most recent snapshot to see what it looks like
    const latestSnapshot = await historyCollection.findOne({}, { sort: { timestamp: -1 } });
    if (latestSnapshot) {
      console.log(`\n📸 Latest snapshot: ${new Date(latestSnapshot.timestamp).toISOString()}`);
      console.log(`   - Total nodes in snapshot: ${latestSnapshot.totalNodes}`);
      console.log(`   - Node snapshots array length: ${latestSnapshot.nodeSnapshots?.length || 0}`);
      console.log(`   - Interval: ${latestSnapshot.interval}`);
    }
    
    // Check each node for historical data
    const nodesWithHistory = [];
    const nodesWithoutHistory = [];
    
    console.log(`\n🔍 Checking history for each node...`);
    
    for (const node of allNodes) {
      const pubkey = node.pubkey || node.publicKey || node._id;
      
      // Query historical snapshots for this node
      const historyCount = await historyCollection.countDocuments({
        'nodeSnapshots.pubkey': pubkey
      });
      
      if (historyCount > 0) {
        nodesWithHistory.push({ pubkey, ip: node.ip, historyCount });
      } else {
        nodesWithoutHistory.push({ pubkey, ip: node.ip, createdAt: node.createdAt });
      }
    }
    
    console.log(`\n✅ Nodes WITH history: ${nodesWithHistory.length}`);
    console.log(`❌ Nodes WITHOUT history: ${nodesWithoutHistory.length}`);
    
    if (nodesWithoutHistory.length > 0) {
      console.log(`\n❌ Nodes WITHOUT historical data:`);
      nodesWithoutHistory.slice(0, 10).forEach(node => {
        const createdDate = node.createdAt ? new Date(node.createdAt).toISOString() : 'unknown';
        console.log(`   - ${node.pubkey.substring(0, 20)}... (${node.ip}) created: ${createdDate}`);
      });
      
      if (nodesWithoutHistory.length > 10) {
        console.log(`   ... and ${nodesWithoutHistory.length - 10} more`);
      }
      
      // Check if these are new nodes
      const now = Date.now();
      const newNodes = nodesWithoutHistory.filter(n => {
        if (!n.createdAt) return false;
        const createdTime = new Date(n.createdAt).getTime();
        return (now - createdTime) < (60 * 60 * 1000); // Created in last hour
      });
      
      console.log(`\n📌 Of those, ${newNodes.length} are NEW nodes (created in last hour)`);
      console.log(`📌 ${nodesWithoutHistory.length - newNodes.length} are OLD nodes but missing history`);
      
      // Check if old nodes have invalid pubkeys in snapshots
      if (nodesWithoutHistory.length - newNodes.length > 0) {
        console.log(`\n🔍 Investigating why old nodes are missing history...`);
        const oldNode = nodesWithoutHistory.find(n => {
          if (!n.createdAt) return true;
          const createdTime = new Date(n.createdAt).getTime();
          return (now - createdTime) > (60 * 60 * 1000);
        });
        
        if (oldNode) {
          console.log(`\n🔎 Sample old node without history:`);
          console.log(`   Pubkey: ${oldNode.pubkey}`);
          console.log(`   IP: ${oldNode.ip}`);
          
          // Check if ANY snapshot has this node with different pubkey field
          const sampleSnapshot = await historyCollection.findOne({
            'nodeSnapshots.pubkey': { $exists: true }
          });
          
          if (sampleSnapshot && sampleSnapshot.nodeSnapshots.length > 0) {
            const sampleNodeSnapshot = sampleSnapshot.nodeSnapshots[0];
            console.log(`\n📝 Sample node snapshot structure:`);
            console.log(`   Keys: ${Object.keys(sampleNodeSnapshot).join(', ')}`);
            console.log(`   Pubkey field: ${sampleNodeSnapshot.pubkey ? 'EXISTS' : 'MISSING'}`);
          }
        }
      }
    }
    
    // Sample a node with history to show structure
    if (nodesWithHistory.length > 0) {
      const sampleNode = nodesWithHistory[0];
      console.log(`\n✅ Sample node WITH history:`);
      console.log(`   Pubkey: ${sampleNode.pubkey.substring(0, 30)}...`);
      console.log(`   IP: ${sampleNode.ip}`);
      console.log(`   History entries: ${sampleNode.historyCount}`);
      
      // Get recent history points
      const recentHistory = await historyCollection
        .find({ 'nodeSnapshots.pubkey': sampleNode.pubkey })
        .sort({ timestamp: -1 })
        .limit(3)
        .toArray();
      
      console.log(`\n   Recent history (last 3 entries):`);
      recentHistory.forEach(snapshot => {
        const nodeData = snapshot.nodeSnapshots.find(n => n.pubkey === sampleNode.pubkey);
        console.log(`   - ${new Date(snapshot.timestamp).toISOString()}: status=${nodeData?.status}, cpu=${nodeData?.cpuPercent}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkNodeHistory().catch(console.error);

