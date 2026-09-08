import { getDb } from '../../db/mongo.js';

export const DEMO_FINGERPRINTS = [
  {
    x: -11.75,
    y: 7.25,
    label: 'Room 201',
    aps: [
      { bssid: 'AA:BB:CC:00:01:01', rssi: -35 },
      { bssid: 'AA:BB:CC:00:01:02', rssi: -45 },
      { bssid: 'AA:BB:CC:00:04:01', rssi: -55 }
    ]
  },
  {
    x: -7.25,
    y: 7.25,
    label: 'Room 202',
    aps: [
      { bssid: 'AA:BB:CC:00:01:01', rssi: -45 },
      { bssid: 'AA:BB:CC:00:01:02', rssi: -35 },
      { bssid: 'AA:BB:CC:00:01:03', rssi: -45 }
    ]
  },
  {
    x: -2.75,
    y: 7.25,
    label: 'Room 203',
    aps: [
      { bssid: 'AA:BB:CC:00:01:02', rssi: -50 },
      { bssid: 'AA:BB:CC:00:01:03', rssi: -35 },
      { bssid: 'AA:BB:CC:00:01:04', rssi: -40 }
    ]
  },
  {
    x: 1.75,
    y: 7.25,
    label: 'Room 204',
    aps: [
      { bssid: 'AA:BB:CC:00:01:03', rssi: -55 },
      { bssid: 'AA:BB:CC:00:01:04', rssi: -30 },
      { bssid: 'AA:BB:CC:00:01:05', rssi: -40 }
    ]
  },
  {
    x: 5.75,
    y: 7.25,
    label: 'stair-nm',
    aps: [
      { bssid: 'AA:BB:CC:00:01:04', rssi: -50 },
      { bssid: 'AA:BB:CC:00:01:05', rssi: -35 },
      { bssid: 'AA:BB:CC:00:01:06', rssi: -45 }
    ]
  },
  {
    x: 9.75,
    y: 7.25,
    label: 'Room 205',
    aps: [
      { bssid: 'AA:BB:CC:00:01:05', rssi: -55 },
      { bssid: 'AA:BB:CC:00:01:06', rssi: -30 },
      { bssid: 'AA:BB:CC:00:01:07', rssi: -45 }
    ]
  },
  {
    x: 0.0,
    y: 0.0,
    label: 'central-island',
    aps: [
      { bssid: 'AA:BB:CC:00:02:01', rssi: -30 },
      { bssid: 'AA:BB:CC:00:02:02', rssi: -40 },
      { bssid: 'AA:BB:CC:00:02:03', rssi: -45 }
    ]
  },
  {
    x: -7.5,
    y: 0.0,
    label: 'Room 211',
    aps: [
      { bssid: 'AA:BB:CC:00:02:01', rssi: -45 },
      { bssid: 'AA:BB:CC:00:02:02', rssi: -30 },
      { bssid: 'AA:BB:CC:00:03:01', rssi: -55 }
    ]
  },
  {
    x: 7.5,
    y: 0.0,
    label: 'Room 209',
    aps: [
      { bssid: 'AA:BB:CC:00:02:03', rssi: -30 },
      { bssid: 'AA:BB:CC:00:03:03', rssi: -50 },
      { bssid: 'AA:BB:CC:00:01:06', rssi: -55 }
    ]
  }
];

export async function seedFingerprints(): Promise<void> {
  try {
    const db = getDb();
    const count = await db.collection('fingerprints').countDocuments();
    if (count > 0) {
      console.log(`[seed] ${count} fingerprints already present in Atlas, skipping seed`);
      return;
    }
    const result = await db.collection('fingerprints').insertMany(DEMO_FINGERPRINTS);
    console.log(`[seed] Inserted ${result.insertedCount} demo fingerprints into Atlas`);
  } catch (err: any) {
    console.warn('[seed] Fingerprint seeding notice:', err?.message || err);
  }
}
