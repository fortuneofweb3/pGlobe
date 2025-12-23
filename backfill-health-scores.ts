/**
 * Backfill Network Health Scores for Historical Snapshots
 *
 * This script calculates and adds network health scores to existing historical snapshots
 * that were created before the health calculation logic was added.
 *
 * Run with: npx tsx backfill-health-scores.ts
 */

import { MongoClient } from 'mongodb';
import { getLatestVersion } from './lib/utils/network-health';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/xandeum-analytics';
const BATCH_SIZE = 100;

interface NodeSnapshot {
  pubkey: string;
  status: 'online' | 'offline' | 'syncing';
  version?: string;
  nodeLocation?: {
    country?: string;
    city?: string;
  };
}

interface HistoricalSnapshot {
  _id: any;
  timestamp: number;
  interval: string;
  nodeSnapshots: NodeSnapshot[];
  networkHealthScore?: number;
  networkHealthAvailability?: number;
  networkHealthVersion?: number;
  networkHealthDistribution?: number;
}

function calculateHealthForSnapshot(snapshot: HistoricalSnapshot) {
  const nodes = snapshot.nodeSnapshots;

  if (nodes.length === 0) {
    return {
      networkHealthScore: 0,
      networkHealthAvailability: 0,
      networkHealthVersion: 0,
      networkHealthDistribution: 0,
    };
  }

  // 1. Availability (40% weight) - % of nodes online
  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const availability = Math.round((onlineNodes / nodes.length) * 100);

  // 2. Version Health (35% weight) - % on latest version
  const versions = nodes.map(n => n.version).filter((v): v is string => !!v && v !== 'Unknown' && v !== 'unknown');
  const latestVersion = getLatestVersion(versions);
  const latestVersionNodes = latestVersion ? nodes.filter(n => n.version === latestVersion).length : 0;
  const versionHealth = latestVersion && nodes.length > 0 ? Math.round((latestVersionNodes / nodes.length) * 100) : 0;

  // 3. Distribution (25% weight) - Geographic diversity
  const countries = new Set(nodes.map(n => n.nodeLocation?.country).filter(c => c));
  const cities = new Set(nodes.map(n => n.nodeLocation?.city).filter(c => c));
  const countryDiversity = Math.min(100, (countries.size / 10) * 100);
  const cityDiversity = Math.min(100, (cities.size / 20) * 100);
  const distribution = Math.round(countryDiversity * 0.6 + cityDiversity * 0.4);

  // Overall weighted score (40% availability, 35% version, 25% distribution)
  const overall = Math.round(
    availability * 0.40 +
    versionHealth * 0.35 +
    distribution * 0.25
  );

  return {
    networkHealthScore: overall,
    networkHealthAvailability: availability,
    networkHealthVersion: versionHealth,
    networkHealthDistribution: distribution,
  };
}

async function backfillHealthScores() {
  console.log('🔄 Starting health score backfill...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const collection = db.collection<HistoricalSnapshot>('node_history');

    // Find all snapshots without health scores
    const query: any = {
      $or: [
        { networkHealthScore: { $exists: false } },
        { networkHealthScore: null },
        { networkHealthScore: undefined },
      ]
    };

    const totalCount = await collection.countDocuments(query);
    console.log(`📊 Found ${totalCount} snapshots to backfill\n`);

    if (totalCount === 0) {
      console.log('✨ All snapshots already have health scores!');
      return;
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Process in batches
    const cursor = collection.find(query).batchSize(BATCH_SIZE);

    const bulkOps: any[] = [];

    for await (const snapshot of cursor) {
      try {
        const healthScores = calculateHealthForSnapshot(snapshot);

        bulkOps.push({
          updateOne: {
            filter: { _id: snapshot._id },
            update: {
              $set: healthScores
            }
          }
        });

        processed++;

        // Execute batch when full
        if (bulkOps.length >= BATCH_SIZE) {
          const result = await collection.bulkWrite(bulkOps);
          updated += result.modifiedCount;
          bulkOps.length = 0; // Clear array
          console.log(`⏳ Progress: ${processed}/${totalCount} (${Math.round(processed / totalCount * 100)}%) - Updated: ${updated}`);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Failed to process snapshot ${snapshot.interval}:`, error);
      }
    }

    // Execute remaining operations
    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps);
      updated += result.modifiedCount;
      console.log(`⏳ Progress: ${processed}/${totalCount} (100%) - Updated: ${updated}`);
    }

    console.log('\n✅ Backfill complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Total snapshots processed: ${processed}`);
    console.log(`   - Successfully updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);

    // Show a sample of updated data
    const sample = await collection.findOne({ networkHealthScore: { $exists: true } });
    if (sample) {
      console.log(`\n📝 Sample updated snapshot (${sample.interval}):`);
      console.log(`   - Overall Health: ${sample.networkHealthScore}%`);
      console.log(`   - Availability: ${sample.networkHealthAvailability}%`);
      console.log(`   - Version Health: ${sample.networkHealthVersion}%`);
      console.log(`   - Distribution: ${sample.networkHealthDistribution}%`);
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the backfill
backfillHealthScores()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
