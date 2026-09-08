import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoClient, Db } from "mongodb";

// Resolve paths relative to script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load environment configuration
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routeguard";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "routeguard";

interface SurveyFingerprintRecord {
  location: string;
  x: number;
  y: number;
  floorId: string;
  bssids: Record<string, number>;
  apCount?: number;
}

interface GeofenceRecord {
  id: string;
  name: string;
  floorId: string;
  polygon: Array<{ x: number; y: number }>;
  minDwellSeconds: number;
  isSafeZone: boolean;
  description: string;
}

interface EmergencyContactRecord {
  id: string;
  role: string;
  phone: string;
  extension: string;
  location: string;
  priority: number;
  available24x7: boolean;
  department: string;
}

interface PoiRecord {
  id: string;
  name: string;
  category: string;
  nodeId: string;
  aliases: string[];
}

export async function seedDemoDatabase(): Promise<{
  fingerprintsCount: number;
  geofencesCount: number;
  contactsCount: number;
  poisCount: number;
}> {
  console.log("======================================================");
  console.log("🌱 CampusSafe Demo Data Initializer");
  console.log("======================================================");
  console.log(`Target Database URI: ${MONGODB_URI}`);
  console.log(`Database Name:       ${MONGODB_DB_NAME}`);
  console.log("------------------------------------------------------");

  let client: MongoClient;
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000
    });
    await client.connect();
    await client.db(MONGODB_DB_NAME).command({ ping: 1 });
    console.log("✓ Connected to MongoDB server successfully.");
  } catch (err: any) {
    console.error("❌ Failed to connect to MongoDB server:");
    console.error(`   ${err?.message || err}`);
    console.error("\nPlease ensure MongoDB is running:");
    console.error("  - Run: ./setup_mongo.sh (to start local container)");
    console.error("  - Or verify MONGODB_URI in your .env file.\n");
    throw err;
  }

  const db: Db = client.db(MONGODB_DB_NAME);

  try {
    // ------------------------------------------------------------------------
    // 1. Seed 28 Floor 2 WiFi Fingerprints into `locations`
    // ------------------------------------------------------------------------
    console.log("\n📡 [1/4] Seeding Floor 2 WiFi Fingerprints into 'locations'...");
    const fingerprintsPath = path.join(rootDir, "data/sample/floor2-fingerprints.json");
    if (!fs.existsSync(fingerprintsPath)) {
      throw new Error(`Fingerprints file not found at: ${fingerprintsPath}`);
    }

    const rawFingerprints: SurveyFingerprintRecord[] = JSON.parse(
      fs.readFileSync(fingerprintsPath, "utf-8")
    );

    console.log(`   Found ${rawFingerprints.length} surveyed fingerprints in sample fixtures.`);

    const locationsCol = db.collection("locations");
    let upsertedFingerprints = 0;

    for (const fp of rawFingerprints) {
      const bssids = fp.bssids || {};
      const pairsText = Object.entries(bssids)
        .map(([bssid, sig]) => `${bssid}: ${sig}%`)
        .join(" | ");

      const pairsJson = JSON.stringify(
        Object.fromEntries(
          Object.entries(bssids).map(([bssid, sig]) => [
            bssid,
            { signal: `${sig}%`, frequency: bssid.includes("5F") ? "5 GHz" : "2.4 GHz" }
          ])
        )
      );

      const doc = {
        location: fp.location,
        x: Number(fp.x),
        y: Number(fp.y),
        floorId: fp.floorId || "floor-2",
        bssids,
        count: Object.keys(bssids).length,
        apCount: Object.keys(bssids).length,
        bssid_pairs_text: pairsText,
        bssid_pairs_json: pairsJson,
        updatedAt: new Date(),
        seededForDemo: true
      };

      await locationsCol.replaceOne(
        { location: fp.location },
        doc,
        { upsert: true }
      );
      upsertedFingerprints++;
    }

    // Ensure indexes on locations
    await locationsCol.createIndex({ location: 1 }, { unique: true });
    await locationsCol.createIndex({ floorId: 1 });
    await locationsCol.createIndex({ x: 1, y: 1 });
    console.log(`✓ Successfully seeded ${upsertedFingerprints} fingerprints with indexes.`);

    // ------------------------------------------------------------------------
    // 2. Populate Initial Safe Zones / Geofences
    // ------------------------------------------------------------------------
    console.log("\n🛡️  [2/4] Populating Safe Zones & Geofences into 'geofences'...");
    const geofences: GeofenceRecord[] = [
      {
        id: "geofence-library-safe-zone",
        name: "Library Safe Zone",
        floorId: "floor-2",
        polygon: [
          { x: 640, y: 180 },
          { x: 760, y: 180 },
          { x: 760, y: 320 },
          { x: 640, y: 320 }
        ],
        minDwellSeconds: 30,
        isSafeZone: true,
        description:
          "Designated quiet study safe refuge area equipped with emergency intercom, fire dampeners, and direct East Fire Exit egress."
      },
      {
        id: "geofence-classroom-wing-b",
        name: "Classroom Wing B",
        floorId: "floor-2",
        polygon: [
          { x: 200, y: 180 },
          { x: 460, y: 180 },
          { x: 460, y: 320 },
          { x: 200, y: 320 }
        ],
        minDwellSeconds: 15,
        isSafeZone: true,
        description:
          "Main academic lecture room cluster (Rooms 206-212) with dual-access corridors to West Ramp and Central Stairwell."
      }
    ];

    const geofencesCol = db.collection("geofences");
    const safeZonesCol = db.collection("safe_zones");

    for (const gf of geofences) {
      await geofencesCol.replaceOne({ id: gf.id }, gf, { upsert: true });
      await safeZonesCol.replaceOne({ id: gf.id }, gf, { upsert: true });
    }

    await geofencesCol.createIndex({ id: 1 }, { unique: true });
    await geofencesCol.createIndex({ floorId: 1 });
    await safeZonesCol.createIndex({ id: 1 }, { unique: true });
    console.log(`✓ Populated ${geofences.length} safe zones (Library Safe Zone, Classroom Wing B).`);

    // ------------------------------------------------------------------------
    // 3. Initialize Sample Emergency Contacts
    // ------------------------------------------------------------------------
    console.log("\n📞 [3/4] Initializing Campus Emergency Contacts into 'emergency_contacts'...");
    const emergencyContacts: EmergencyContactRecord[] = [
      {
        id: "contact-sec-01",
        role: "Campus Emergency Security",
        phone: "+91 141 3999100",
        extension: "100",
        location: "AB1 Central Security Desk",
        priority: 1,
        available24x7: true,
        department: "Campus Safety & Surveillance"
      },
      {
        id: "contact-med-01",
        role: "Medical Centre / Campus Ambulance",
        phone: "+91 141 3999102",
        extension: "102",
        location: "Student Activity Center (SAC) Ground Floor",
        priority: 1,
        available24x7: true,
        department: "University Health Services"
      },
      {
        id: "contact-fire-01",
        role: "Fire Hazard Quick Response",
        phone: "+91 141 3999101",
        extension: "101",
        location: "Fire Station Post West",
        priority: 1,
        available24x7: true,
        department: "Disaster Management & Fire Safety"
      },
      {
        id: "contact-warden-01",
        role: "Floor Safety Warden (Floor 2)",
        phone: "+91 141 3999208",
        extension: "208",
        location: "Room 208 Corridor Desk",
        priority: 2,
        available24x7: false,
        department: "Academic Block 1 Administration"
      },
      {
        id: "contact-guardian-01",
        role: "Student Guardian Helpline",
        phone: "+91 141 3999199",
        extension: "199",
        location: "Campus Safety Operations Center",
        priority: 2,
        available24x7: true,
        department: "Student Affairs & Parent Relations"
      },
      {
        id: "contact-proctor-01",
        role: "Chief Proctor Office",
        phone: "+91 141 3999105",
        extension: "105",
        location: "Administrative Block First Floor",
        priority: 3,
        available24x7: false,
        department: "University Proctorial Board"
      }
    ];

    const contactsCol = db.collection("emergency_contacts");
    for (const c of emergencyContacts) {
      await contactsCol.replaceOne({ id: c.id }, c, { upsert: true });
    }

    await contactsCol.createIndex({ id: 1 }, { unique: true });
    await contactsCol.createIndex({ priority: 1 });
    await contactsCol.createIndex({ role: 1 });
    console.log(`✓ Initialized ${emergencyContacts.length} emergency contacts.`);

    // ------------------------------------------------------------------------
    // 4. Initialize POI Search Index into `pois`
    // ------------------------------------------------------------------------
    console.log("\n🔍 [4/4] Initializing POI Search Index into 'pois'...");
    const poisPath = path.join(rootDir, "data/sample/pois.json");
    if (!fs.existsSync(poisPath)) {
      throw new Error(`POIs file not found at: ${poisPath}`);
    }

    const rawPois: PoiRecord[] = JSON.parse(fs.readFileSync(poisPath, "utf-8"));
    const poisCol = db.collection("pois");

    for (const poi of rawPois) {
      await poisCol.replaceOne({ id: poi.id }, poi, { upsert: true });
    }

    // Create unique ID index and comprehensive full-text search index
    await poisCol.createIndex({ id: 1 }, { unique: true });
    await poisCol.createIndex({ nodeId: 1 });
    await poisCol.createIndex({ category: 1 });

    try {
      await poisCol.createIndex(
        {
          name: "text",
          aliases: "text",
          category: "text"
        },
        {
          name: "poi_text_search_idx",
          weights: {
            name: 10,
            aliases: 5,
            category: 2
          }
        }
      );
      console.log("   Created text search index 'poi_text_search_idx' on (name, aliases, category).");
    } catch (idxErr: any) {
      console.log(`   Text index note: ${idxErr?.message || idxErr}`);
    }

    console.log(`✓ Initialized ${rawPois.length} POIs into 'pois' collection.`);

    console.log("\n======================================================");
    console.log("✨ DEMO DATABASE SEEDING COMPLETE");
    console.log("======================================================");
    console.log(`• Locations / Fingerprints: ${upsertedFingerprints} records`);
    console.log(`• Safe Zones / Geofences:   ${geofences.length} zones`);
    console.log(`• Emergency Contacts:       ${emergencyContacts.length} contacts`);
    console.log(`• Searchable POIs:          ${rawPois.length} places`);
    console.log("======================================================\n");

    return {
      fingerprintsCount: upsertedFingerprints,
      geofencesCount: geofences.length,
      contactsCount: emergencyContacts.length,
      poisCount: rawPois.length
    };
  } finally {
    await client.close();
  }
}

// Execute standalone if called directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  seedDemoDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[FATAL] Seeding failed:", err);
      process.exit(1);
    });
}
