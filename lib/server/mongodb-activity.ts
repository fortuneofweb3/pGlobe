import { Collection, Db } from 'mongodb';
import { getDb } from './mongodb-nodes';

export type ActivityType =
    | 'status_change'
    | 'credits_earned'
    | 'node_online'
    | 'node_offline'
    | 'node_syncing'
    | 'new_node'
    | 'packets_earned'
    | 'streams_active';

export interface ActivityLog {
    _id?: string;
    timestamp: Date;
    pubkey: string;
    address?: string;
    type: ActivityType;
    message: string;
    data?: any;
    location?: string;
    countryCode?: string;
}

export async function getActivityCollection(): Promise<Collection<ActivityLog>> {
    const db = await getDb();
    return db.collection<ActivityLog>('activity_logs');
}

export async function storeActivityLog(log: Omit<ActivityLog, 'timestamp'>): Promise<void> {
    try {
        const collection = await getActivityCollection();
        await collection.insertOne({
            ...log,
            timestamp: new Date(),
        });
    } catch (error: any) {
        console.error('[Activity] ❌ Failed to store activity log:', error.message);
    }
}

export async function getActivityLogs(options: {
    pubkey?: string,
    address?: string,
    countryCode?: string,
    limit?: number,
    skip?: number,
    type?: ActivityType
} = {}): Promise<ActivityLog[]> {
    try {
        const collection = await getActivityCollection();
        const query: any = {};

        if (options.pubkey) query.pubkey = options.pubkey;
        if (options.address) query.address = options.address;
        if (options.countryCode) query.countryCode = options.countryCode;
        if (options.type) query.type = options.type;

        return await collection
            .find(query)
            .sort({ timestamp: -1 })
            .skip(options.skip || 0)
            .limit(options.limit || 50)
            .toArray();
    } catch (error: any) {
        console.error('[Activity] ❌ Failed to fetch activity logs:', error.message);
        return [];
    }
}

export async function createActivityIndexes(): Promise<void> {
    try {
        const collection = await getActivityCollection();
        await collection.createIndex({ timestamp: -1 });
        await collection.createIndex({ pubkey: 1, timestamp: -1 });
        await collection.createIndex({ countryCode: 1, timestamp: -1 });
        console.log('[Activity] ✅ Created indexes for activity_logs');
    } catch (error: any) {
        console.error('[Activity] ❌ Failed to create activity indexes:', error.message);
    }
}
