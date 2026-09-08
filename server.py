#!/usr/bin/env python3
"""
iBUS@MUJ WiFi BSSID Mapper - Local Server with MongoDB Integration
Strictly filters and captures genuine iBUS@MUJ enterprise APs.
Saves each location as a single row with all BSSIDs as key-value pairs.
Automatically connects to MongoDB with graceful SQLite fallback.
"""

import os
import sys
import subprocess
import json
import sqlite3
import datetime
import re
from urllib.parse import urlparse
from flask import Flask, send_from_directory, jsonify, request, Response

# Load environment variables from .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__, static_folder=".", static_url_path="")

# ---------------------------------------------------------
# Database Configuration (MongoDB with SQLite Fallback)
# ---------------------------------------------------------
DB_FILE = "wifi_bssid_map.db"
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/routeguard")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "routeguard")

USE_MONGODB = False
mongo_client = None
mongo_db = None
locations_col = None

def mask_mongo_uri(uri):
    """Masks credentials in MongoDB connection string for safe API exposure."""
    try:
        if "@" in uri:
            prefix = uri.split("://")[0] + "://"
            rest = uri.split("://")[1]
            creds, host_part = rest.split("@", 1)
            return f"{prefix}***:***@{host_part}"
        return uri
    except Exception:
        return "mongodb://***"

def init_sqlite():
    """Initializes local SQLite database as primary or fallback."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location TEXT UNIQUE NOT NULL,
                bssid_pairs_text TEXT NOT NULL,
                bssid_pairs_json TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                timestamp TEXT
            )
        """)
        conn.commit()
    conn.close()

def migrate_sqlite_to_mongodb():
    """Seamlessly migrates existing SQLite rows into MongoDB if collection is empty."""
    global locations_col
    if not os.path.exists(DB_FILE) or locations_col is None:
        return 0
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM locations").fetchall()
        conn.close()
        if not rows:
            return 0
        docs = []
        for r in rows:
            docs.append({
                "location": r["location"],
                "bssid_pairs_text": r["bssid_pairs_text"],
                "bssid_pairs_json": r["bssid_pairs_json"],
                "count": r["count"],
                "timestamp": r["timestamp"]
            })
        if docs:
            locations_col.insert_many(docs, ordered=False)
            print(f"📦 Migrated {len(docs)} location records from SQLite to MongoDB.")
        return len(docs)
    except Exception as e:
        print(f"⚠️ SQLite to MongoDB migration notice: {e}")
        return 0

def init_database():
    """Attempts to connect to MongoDB; gracefully falls back to SQLite."""
    global USE_MONGODB, mongo_client, mongo_db, locations_col
    try:
        import pymongo
        print(f"🍃 Connecting to MongoDB at {mask_mongo_uri(MONGODB_URI)}...")
        client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2500)
        # Test connection
        client.admin.command('ping')
        
        # Extract database name if specified in URI
        db_name = MONGODB_DB_NAME
        try:
            parsed = urlparse(MONGODB_URI)
            path_db = parsed.path.strip("/")
            if path_db and "?" not in path_db:
                db_name = path_db
            elif path_db and "?" in path_db:
                db_name = path_db.split("?")[0]
        except Exception:
            pass

        mongo_client = client
        mongo_db = client[db_name]
        locations_col = mongo_db["locations"]

        # Ensure indexes
        locations_col.create_index("location", unique=True)
        locations_col.create_index("timestamp")

        USE_MONGODB = True
        print(f"✓ Connected to MongoDB! Database: '{db_name}', Collection: 'locations'")

        # Auto-migrate SQLite if MongoDB collection is empty
        if locations_col.count_documents({}) == 0:
            migrate_sqlite_to_mongodb()

    except Exception as err:
        USE_MONGODB = False
        print(f"⚠️  MongoDB connection failed ({err}).")
        print(f"📁 Initializing fallback SQLite database ({DB_FILE})...")
        init_sqlite()
        print("✓ Running on SQLite fallback.")

init_database()

# ---------------------------------------------------------
# Database Operation Helpers
# ---------------------------------------------------------
def db_get_all_locations():
    """Fetches all location mapping rows."""
    if USE_MONGODB and locations_col is not None:
        try:
            docs = list(locations_col.find({}, {"_id": 0}).sort("timestamp", -1))
            for idx, doc in enumerate(docs, 1):
                doc["id"] = idx
            return docs
        except Exception as e:
            print(f"MongoDB read error: {e}, falling back to SQLite")
    
    # SQLite Fallback
    init_sqlite()
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM locations ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_upsert_location(location, pairs_text, pairs_json, count, timestamp):
    """Inserts or updates a location record."""
    if USE_MONGODB and locations_col is not None:
        try:
            doc = {
                "location": location,
                "bssid_pairs_text": pairs_text,
                "bssid_pairs_json": pairs_json,
                "count": count,
                "timestamp": timestamp
            }
            locations_col.replace_one({"location": location}, doc, upsert=True)
            return True
        except Exception as e:
            print(f"MongoDB write error: {e}, saving to SQLite")

    # SQLite Fallback
    init_sqlite()
    conn = sqlite3.connect(DB_FILE)
    with conn:
        conn.execute("""
            INSERT OR REPLACE INTO locations 
            (location, bssid_pairs_text, bssid_pairs_json, count, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (location, pairs_text, pairs_json, count, timestamp))
        conn.commit()
    conn.close()
    return True

def db_delete_location(identifier):
    """Deletes by ID or location name."""
    deleted = False
    if USE_MONGODB and locations_col is not None:
        try:
            if isinstance(identifier, int):
                # Delete by position in descending list
                docs = list(locations_col.find({}, {"location": 1}).sort("timestamp", -1))
                if 0 <= identifier - 1 < len(docs):
                    target_loc = docs[identifier - 1]["location"]
                    locations_col.delete_one({"location": target_loc})
                    deleted = True
            else:
                res = locations_col.delete_one({"location": identifier})
                deleted = res.deleted_count > 0
        except Exception as e:
            print(f"MongoDB delete error: {e}")

    # Also remove from SQLite
    try:
        init_sqlite()
        conn = sqlite3.connect(DB_FILE)
        with conn:
            if isinstance(identifier, int):
                conn.execute("DELETE FROM locations WHERE id = ?", (identifier,))
            else:
                conn.execute("DELETE FROM locations WHERE location = ?", (identifier,))
            conn.commit()
        conn.close()
        deleted = True
    except Exception:
        pass
    return deleted

def db_clear_all():
    """Clears all records."""
    if USE_MONGODB and locations_col is not None:
        try:
            locations_col.delete_many({})
        except Exception as e:
            print(f"MongoDB clear error: {e}")
    try:
        init_sqlite()
        conn = sqlite3.connect(DB_FILE)
        with conn:
            conn.execute("DELETE FROM locations")
            conn.commit()
        conn.close()
    except Exception:
        pass

def db_get_count():
    """Returns total record count."""
    if USE_MONGODB and locations_col is not None:
        try:
            return locations_col.count_documents({})
        except Exception:
            pass
    try:
        conn = sqlite3.connect(DB_FILE)
        count = conn.execute("SELECT count(*) FROM locations").fetchone()[0]
        conn.close()
        return count
    except Exception:
        return 0

# ---------------------------------------------------------
# Wi-Fi Chip Scanner & BSSID Verification
# ---------------------------------------------------------
def is_ibus_muj_ap(bssid, ssid):
    """
    Validates genuine iBUS@MUJ Enterprise Access Points:
    1. SSID contains MUJ or IBUS.
    2. OUI Hardware Prefix: Aruba/HPE campus APs (90:14:AF:5F or FC:11:65).
    3. Last Hex Digit: Always ends in '0' due to Aruba 16-BSSID VAP allocation.
    """
    b = bssid.upper()
    s = ssid.upper()
    
    # 1. Check SSID
    if not ("MUJ" in s or "IBUS" in s):
        return False
        
    # 2. Check Aruba Enterprise Hardware Signature at MUJ
    is_aruba = b.startswith("90:14:AF:5F") or b.startswith("FC:11:65")
    
    # 3. Check VAP offset alignment (Aruba BSSIDs end in 0)
    ends_with_zero = b.endswith("0")
    
    return is_aruba and ends_with_zero

def scan_wifi_chip(rescan=False):
    """Scans nearby WiFi networks using nmcli and parses all iBUS@MUJ APs."""
    try:
        if rescan:
            subprocess.run(["nmcli", "dev", "wifi", "rescan"], capture_output=True, timeout=5)

        cmd = [
            "nmcli", "-t", "-f",
            "IN-USE,BSSID,SSID,MODE,CHAN,FREQ,RATE,SIGNAL,SECURITY",
            "dev", "wifi", "list"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        lines = res.stdout.strip().split("\n")
        
        aps = []
        connected_bssid = None
        seen_bssids = set()
        
        for line in lines:
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 8:
                in_use = parts[0].strip() == "*"
                bssid = ":".join(parts[1:7]).replace("\\", "").upper()
                rest = parts[7:]
                ssid = rest[0]
                
                # Strict check: only genuine iBUS@MUJ enterprise APs
                if not is_ibus_muj_ap(bssid, ssid):
                    continue
                
                if bssid in seen_bssids:
                    continue
                seen_bssids.add(bssid)
                
                chan = rest[2] if len(rest) > 2 else ""
                freq = rest[3] if len(rest) > 3 else ""
                rate = rest[4] if len(rest) > 4 else ""
                sig = rest[5] if len(rest) > 5 else "80"
                
                if in_use:
                    connected_bssid = bssid
                    
                is_5g = "5" in freq or (chan.isdigit() and int(chan) > 14)
                frequency_label = "5 GHz" if is_5g else "2.4 GHz"

                aps.append({
                    "bssid": bssid,
                    "ssid": ssid,
                    "in_use": in_use,
                    "channel": chan,
                    "frequency": frequency_label,
                    "rate": rate,
                    "signal": int(sig) if sig.isdigit() else 80
                })
                
        aps.sort(key=lambda x: x["signal"], reverse=True)
        return {"aps": aps, "connected_bssid": connected_bssid, "total_visible": len(aps)}
    except Exception as e:
        return {"error": str(e), "aps": [], "connected_bssid": None, "total_visible": 0}

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

@app.route("/api/db-status")
def api_db_status():
    """Returns real-time status of database connection."""
    # Test MongoDB live connection
    is_live = False
    if USE_MONGODB and mongo_client is not None:
        try:
            mongo_client.admin.command('ping')
            is_live = True
        except Exception:
            is_live = False

    return jsonify({
        "type": "mongodb" if is_live else ("sqlite_fallback" if USE_MONGODB else "sqlite"),
        "connected": True,
        "is_mongodb": is_live,
        "database": MONGODB_DB_NAME if is_live else DB_FILE,
        "uri": mask_mongo_uri(MONGODB_URI) if is_live else "local",
        "total_records": db_get_count()
    })

@app.route("/api/scan")
def api_scan():
    rescan = request.args.get("rescan", "false").lower() == "true"
    return jsonify(scan_wifi_chip(rescan=rescan))

@app.route("/api/mappings", methods=["GET"])
def get_mappings():
    return jsonify(db_get_all_locations())

@app.route("/api/mappings", methods=["POST"])
def save_location_row():
    """Saves a location as a single row containing all its BSSIDs as key-value pairs."""
    data = request.json or {}
    location = data.get("location", "").strip()
    bssids = data.get("bssids", [])

    if not location:
        return jsonify({"error": "Location name is required"}), 400
    if not bssids:
        return jsonify({"error": "No BSSIDs provided to save"}), 400

    kv_dict = {}
    text_pairs = []

    for it in bssids:
        bssid = it.get("bssid", "").strip().upper()
        if not bssid:
            continue
        sig = str(it.get("signal", "80%"))
        if not sig.endswith("%"):
            sig += "%"
        
        freq = it.get("frequency", "")
        chan = it.get("channel", "")
        
        kv_dict[bssid] = {
            "signal": sig,
            "frequency": freq,
            "channel": chan
        }
        text_pairs.append(f"{bssid}: {sig}")

    pairs_text = " | ".join(text_pairs)
    pairs_json = json.dumps(kv_dict)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db_upsert_location(
        location=location,
        pairs_text=pairs_text,
        pairs_json=pairs_json,
        count=len(kv_dict),
        timestamp=now_str
    )

    return jsonify({
        "success": True, 
        "location": location, 
        "count": len(kv_dict), 
        "pairs_text": pairs_text,
        "database": "mongodb" if USE_MONGODB else "sqlite"
    })

@app.route("/api/mappings/<int:item_id>", methods=["DELETE"])
def delete_mapping(item_id):
    db_delete_location(item_id)
    return jsonify({"success": True, "id": item_id})

@app.route("/api/mappings/location/<path:location_name>", methods=["DELETE"])
def delete_mapping_by_location(location_name):
    db_delete_location(location_name)
    return jsonify({"success": True, "location": location_name})

@app.route("/api/mappings/clear", methods=["POST"])
def clear_all():
    db_clear_all()
    return jsonify({"success": True})

@app.route("/api/export/csv")
def export_csv():
    import io
    import csv
    rows = db_get_all_locations()
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Location", "BSSID_Key_Value_Pairs", "BSSID_JSON", "AP_Count", "Timestamp"])
    for r in rows:
        writer.writerow([
            r.get("location", ""), 
            r.get("bssid_pairs_text", ""), 
            r.get("bssid_pairs_json", ""), 
            r.get("count", 0), 
            r.get("timestamp", "")
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=muj_wifi_single_row_map_{datetime.date.today()}.csv"}
    )

@app.route("/api/export/json")
def export_json():
    rows = db_get_all_locations()
    
    result = {}
    for r in rows:
        raw_json = r.get("bssid_pairs_json", "{}")
        try:
            result[r["location"]] = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
        except Exception:
            result[r["location"]] = raw_json

    return Response(
        json.dumps(result, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment;filename=muj_wifi_kv_map_{datetime.date.today()}.json"}
    )

# ---------------------------------------------------------
# Entry Point
# ---------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"📡 iBUS@MUJ Strict AP Mapper Server at http://localhost:{port}")
    print(f"💾 Active Storage: {'MongoDB (' + MONGODB_DB_NAME + ')' if USE_MONGODB else 'SQLite (' + DB_FILE + ')'}")
    app.run(host=host, port=port, debug=False)
