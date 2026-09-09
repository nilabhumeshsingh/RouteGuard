import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

interface LocationEntry {
  x: number;
  y: number;
  label: string;
  type?: string;
  visible?: boolean;
}

interface APReadingDoc {
  bssid: string;
  rssi: number;
  signalPercent: number;
  frequency: string;
  freqMhz: number;
  channel: number;
}

interface FingerprintDoc {
  label: string;
  location: string;
  x: number;
  y: number;
  floorId: string;
  type: string;
  visible: boolean;
  aps: APReadingDoc[];
  bssids: Record<string, number>;
  apCount: number;
  surveyedAt: Date;
  importedAt: Date;
}

function resolveFile(filename: string, candidates: string[]): string {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function loadLocations(jsonPath: string): Map<string, LocationEntry> {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);
  const locations: Record<string, LocationEntry> = data.locations || {};
  const lookup = new Map<string, LocationEntry>();

  for (const [key, val] of Object.entries(locations)) {
    lookup.set(key.toUpperCase().trim(), val);
  }
  return lookup;
}

function signalPercentToDbm(percentStr: string | number): number {
  try {
    const pct = parseFloat(String(percentStr).replace("%", "").trim());
    if (isNaN(pct)) return -100;
    return Math.round(((pct / 2) - 100) * 10) / 10;
  } catch {
    return -100;
  }
}

function freqStrToMhz(freqStr: string | number): number {
  const s = String(freqStr || "").toLowerCase().trim();
  if (s.includes("2.4") || s.includes("24")) {
    return 2412;
  } else if (s.includes("5")) {
    return 5180;
  }
  return 2412;
}

function parseCSV(content: string): Array<Record<string, string>> {
  const lines: string[] = [];
  let currentLine = "";
  let insideQuote = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      insideQuote = !insideQuote;
      currentLine += char;
    } else if ((char === "\n" || char === "\r") && !insideQuote) {
      if (char === "\r" && content[i + 1] === "\n") {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  function parseRow(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === "," && !inQuote) {
        fields.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = parseRow(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCsvRow(
  row: Record<string, string>,
  lookup: Map<string, LocationEntry>
): FingerprintDoc | null {
  const locationRaw = (row.Location || "").trim();
  const locationKey = locationRaw.toUpperCase().trim();

  let coords = lookup.get(locationKey);
  if (!coords) {
    for (const [key, val] of lookup.entries()) {
      if (locationKey.includes(key) || key.includes(locationKey)) {
        coords = val;
        break;
      }
    }
  }

  if (!coords) {
    console.warn(`  [!] Unknown location: '${locationRaw}' — skipping`);
    return null;
  }

  const bssidJsonStr = (row.BSSID_JSON || "").trim();
  if (!bssidJsonStr) {
    console.warn(`  [!] No BSSID_JSON for '${locationRaw}' — skipping`);
    return null;
  }

  let apData: Record<string, any>;
  try {
    apData = JSON.parse(bssidJsonStr);
  } catch (err: any) {
    console.warn(`  [!] JSON parse error for '${locationRaw}': ${err.message}`);
    return null;
  }

  const aps: APReadingDoc[] = [];
  const bssids: Record<string, number> = {};

  for (const [bssid, info] of Object.entries(apData)) {
    if (!bssid || !bssid.includes(":")) continue;
    const cleanBssid = bssid.toUpperCase().trim();
    const infoObj = (info as any) || {};
    const rssi = signalPercentToDbm(infoObj.signal ?? "0%");
    const signalPercent = parseFloat(String(infoObj.signal ?? "0%").replace("%", "").trim()) || 0;
    const frequency = String(infoObj.frequency || "");
    const freqMhz = freqStrToMhz(frequency);
    const channel = parseInt(String(infoObj.channel || 0), 10) || 0;

    aps.push({
      bssid: cleanBssid,
      rssi,
      signalPercent,
      frequency,
      freqMhz,
      channel
    });
    bssids[cleanBssid] = rssi;
  }

  if (aps.length === 0) {
    console.warn(`  [!] No APs parsed for '${locationRaw}'`);
    return null;
  }

  const tsStr = (row.Timestamp || "").trim();
  let surveyedAt: Date;
  try {
    surveyedAt = tsStr ? new Date(tsStr) : new Date();
    if (isNaN(surveyedAt.getTime())) surveyedAt = new Date();
  } catch {
    surveyedAt = new Date();
  }

  return {
    label: coords.label,
    location: locationRaw,
    x: coords.x,
    y: coords.y,
    floorId: "floor-2",
    type: coords.type || "office",
    visible: coords.visible ?? true,
    aps,
    bssids,
    apCount: aps.length,
    surveyedAt,
    importedAt: new Date()
  };
}

export async function importSurveyData(options: {
  csvPath?: string;
  locationsPath?: string;
  mongoUri?: string;
  dbName?: string;
  clearExisting?: boolean;
} = {}): Promise<void> {
  const cwd = process.cwd();

  const csvPath = options.csvPath || resolveFile("survey.csv", [
    path.resolve(cwd, "data/survey.csv"),
    path.resolve(cwd, "apps/api/src/data/survey.csv"),
    path.resolve(cwd, "survey.csv")
  ]);

  const locationsPath = options.locationsPath || resolveFile("locations.json", [
    path.resolve(cwd, "apps/api/src/data/locations.json"),
    path.resolve(cwd, "locations.json"),
    path.resolve(cwd, "data/sample/locations.json")
  ]);

  const mongoUri =
    options.mongoUri ||
    process.env.MONGODB_URI ||
    "mongodb+srv://nilabhsingh2006_db_user:B6ufpPf5GMrleyb0@bss.yr6gwzt.mongodb.net/?retryWrites=true&w=majority";

  const dbName = options.dbName || process.env.MONGODB_DB_NAME || "campussafe";
  const clearExisting = options.clearExisting !== false;

  console.log(`[*] Loading locations from: ${locationsPath}`);
  const lookup = loadLocations(locationsPath);
  console.log(`[*] Loaded ${lookup.size} location mappings`);

  console.log(`[*] Reading CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(csvContent);
  console.log(`[*] Parsed ${rows.length} survey rows from CSV`);

  const fingerprints: FingerprintDoc[] = [];
  let skipped = 0;

  for (const row of rows) {
    const fp = parseCsvRow(row, lookup);
    if (fp) {
      fingerprints.push(fp);
      const tag = fp.visible ? "visible" : "CORRIDOR";
      console.log(
        `  ✓ ${fp.location.padEnd(36)} → (${fp.x.toFixed(2).padStart(6)}, ${fp.y.toFixed(2).padStart(6)})  ${String(fp.apCount).padStart(2)} APs  [${tag}]`
      );
    } else {
      skipped++;
    }
  }

  console.log(`\n[*] Successfully parsed ${fingerprints.length} fingerprints (${skipped} skipped)`);
  if (fingerprints.length === 0) {
    console.error("[!] No fingerprints to import.");
    return;
  }

  // Update offline fixture file
  const samplePath = path.resolve(cwd, "data/sample/floor2-fingerprints.json");
  const apiSamplePath = path.resolve(cwd, "apps/api/src/data/sample/floor2-fingerprints.json");
  try {
    fs.mkdirSync(path.dirname(samplePath), { recursive: true });
    fs.writeFileSync(samplePath, JSON.stringify(fingerprints, null, 2));
    if (fs.existsSync(path.dirname(apiSamplePath))) {
      fs.writeFileSync(apiSamplePath, JSON.stringify(fingerprints, null, 2));
    }
    console.log(`[✓] Updated offline sample fixtures at ${samplePath}`);
  } catch (err: any) {
    console.warn(`[!] Fixture write warning: ${err.message}`);
  }

  console.log(`\n[*] Connecting to MongoDB Atlas...`);
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("fingerprints");

    console.log(`[+] Connected to ${dbName}.fingerprints`);

    if (clearExisting) {
      const delResult = await collection.deleteMany({});
      console.log(`[*] Cleared ${delResult.deletedCount} existing fingerprints`);
    }

    const insResult = await collection.insertMany(fingerprints as any[]);
    console.log(`[+] Inserted ${insResult.insertedCount} fingerprints into MongoDB`);

    await collection.createIndex({ label: 1 });
    await collection.createIndex({ location: 1 });
    await collection.createIndex({ "aps.bssid": 1 });
    await collection.createIndex({ visible: 1 });

    const totalCount = await collection.countDocuments({});
    const visibleCount = fingerprints.filter((f) => f.visible).length;
    const corridorCount = fingerprints.filter((f) => !f.visible).length;

    const uniqueBssids = new Set<string>();
    fingerprints.forEach((f) => f.aps.forEach((a) => uniqueBssids.add(a.bssid)));

    console.log(`\n========================================`);
    console.log(`[✓] Total fingerprints: ${totalCount}`);
    console.log(`[✓] Visible rooms: ${visibleCount}`);
    console.log(`[✓] Invisible corridor waypoints: ${corridorCount}`);
    console.log(`[✓] Unique BSSIDs across all fingerprints: ${uniqueBssids.size}`);
    console.log(`========================================`);

    const sample204 = fingerprints.find((f) => f.label.toLowerCase().includes("204"));
    if (sample204) {
      console.log(`\n[✓] Sample fingerprint (Room 204):`);
      console.log(
        JSON.stringify(
          {
            label: sample204.label,
            location: sample204.location,
            x: sample204.x,
            y: sample204.y,
            type: sample204.type,
            visible: sample204.visible,
            apCount: sample204.apCount,
            sampleAps: sample204.aps.slice(0, 3)
          },
          null,
          2
        )
      );
    }
  } catch (err: any) {
    console.error(`[!] MongoDB operation failed: ${err.message}`);
  } finally {
    await client.close();
  }
}

// Direct execution
const isMain = process.argv[1] && (process.argv[1].endsWith("import-survey.ts") || process.argv[1].endsWith("import-survey.js"));
if (isMain) {
  importSurveyData().catch((err) => {
    console.error("[!] Fatal error:", err);
    process.exit(1);
  });
}
