import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const match = uri.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/);
const dbName = match?.[1] || 'pGlobe';

async function cleanup() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection('nodes');

    const before = await coll.countDocuments();
    console.log('Before cleanup:', before);

    // Group by IP (without port)
    const allDocs = await coll.find({}).toArray();
    const ipGroups = new Map<string, any[]>();

    for (const doc of allDocs) {
        const address = String(doc._id) || doc.address || '';
        const ip = address.split(':')[0];
        if (!ip) continue;
        if (!ipGroups.has(ip)) ipGroups.set(ip, []);
        ipGroups.get(ip)!.push(doc);
    }

    const deleteIds: any[] = [];
    for (const [ip, docs] of ipGroups.entries()) {
        if (docs.length <= 1) continue;
        docs.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (b.status === 'online' && a.status !== 'online') return 1;
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime;
        });
        for (let i = 1; i < docs.length; i++) {
            deleteIds.push(docs[i]._id);
        }
    }

    console.log('Found', deleteIds.length, 'duplicates to delete');

    if (deleteIds.length > 0) {
        await coll.deleteMany({ _id: { $in: deleteIds } });
    }

    const after = await coll.countDocuments();
    console.log('After cleanup:', after);
    console.log('Deleted:', before - after);

    await client.close();
}

cleanup();
