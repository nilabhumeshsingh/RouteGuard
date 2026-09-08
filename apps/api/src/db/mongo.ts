import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Ensure environment variables are loaded
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'campussafe';

// Redact password from connection URI for secure logging
export function redactMongoUri(rawUri?: string): string {
  if (!rawUri) return '';
  return rawUri.replace(/:\/\/[^:]+:[^@]+@/, '://****:****@');
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  if (!uri) {
    console.error('[mongo] MONGODB_URI not set in .env');
    throw new Error('MONGODB_URI not set in environment');
  }

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });

  try {
    await client.connect();
    db = client.db(dbName);
    console.log(`[mongo] Connected to ${dbName} on Atlas`);

    // Ensure indexes exist (idempotent)
    await db.collection('scans').createIndex({ deviceId: 1, receivedAt: -1 });
    await db.collection('scans').createIndex(
      { receivedAt: 1 },
      { expireAfterSeconds: 3600 } // auto-delete scans older than 1 hour
    );
    await db.collection('fingerprints').createIndex({ bssid: 1 });
    await db.collection('fingerprints').createIndex({ label: 1 });
    await db.collection('manual_checkpoints').createIndex(
      { receivedAt: 1 },
      { expireAfterSeconds: 3600 }
    );
    await db.collection('alarms').createIndex({ deviceId: 1, receivedAt: -1 });

    return db;
  } catch (err: any) {
    console.error('[mongo] Connection failed:', err?.message || 'Unknown error');
    throw err;
  }
}

export function getDb(): Db {
  if (!db) throw new Error('Mongo not connected. Call connectMongo() first.');
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export { client, db };
