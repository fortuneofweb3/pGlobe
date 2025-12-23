import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getLatestVersion } from '@/lib/utils/network-health';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

interface HistoricalSnapshot {
  _id: any;
  interval: string;
  timestamp: number;
  nodeSnapshots: Array<{
    pubkey: string;
    status: string;
    version?: string;
    locationData?: {
      country?: string;
      city?: string;
    };
  }>;
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

  // 1. Availability (40% weight)
  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const availability = Math.round((onlineNodes / nodes.length) * 100);

  // 2. Version Health (35% weight)
  const versions = nodes.map(n => n.version).filter((v): v is string => !!v && v !== 'Unknown');
  const latestVersion = getLatestVersion(versions);
  const latestVersionNodes = latestVersion ? nodes.filter(n => n.version === latestVersion).length : 0;
  const versionHealth = latestVersion && nodes.length > 0
    ? Math.round((latestVersionNodes / nodes.length) * 100)
    : 0;

  // 3. Distribution (25% weight)
  const countries = new Set(nodes.map(n => n.locationData?.country).filter(c => c));
  const cities = new Set(nodes.map(n => n.locationData?.city).filter(c => c));
  const countryDiversity = Math.min(100, (countries.size / 10) * 100);
  const cityDiversity = Math.min(100, (cities.size / 20) * 100);
  const distribution = Math.round(countryDiversity * 0.6 + cityDiversity * 0.4);

  // Overall (40% + 35% + 25%)
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

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - require admin secret
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'change-me-in-production';

    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Backfill] 🔄 Starting health score backfill...');

    const client = new MongoClient(process.env.MONGODB_URI || '');
    await client.connect();
    console.log('[Backfill] ✅ Connected to MongoDB');

    try {
      const db = client.db('xandeum_analytics');
      const collection = db.collection('node_history');

      // Find all snapshots that don't have health scores
      const snapshots = await collection
        .find({ networkHealthScore: { $exists: false } })
        .toArray() as HistoricalSnapshot[];

      console.log(`[Backfill] 📊 Found ${snapshots.length} snapshots to backfill`);

      if (snapshots.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No snapshots need backfilling',
          processed: 0,
        });
      }

      // Process in batches of 100
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize);
        const bulkOps = batch.map(snapshot => {
          const health = calculateHealthForSnapshot(snapshot);
          return {
            updateOne: {
              filter: { _id: snapshot._id },
              update: {
                $set: {
                  networkHealthScore: health.networkHealthScore,
                  networkHealthAvailability: health.networkHealthAvailability,
                  networkHealthVersion: health.networkHealthVersion,
                  networkHealthDistribution: health.networkHealthDistribution,
                },
              },
            },
          };
        });

        await collection.bulkWrite(bulkOps);
        processed += batch.length;
        console.log(`[Backfill] ✅ Processed ${processed}/${snapshots.length} snapshots`);
      }

      return NextResponse.json({
        success: true,
        message: 'Backfill completed successfully',
        processed,
      });
    } finally {
      await client.close();
    }
  } catch (error: any) {
    console.error('[Backfill] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
