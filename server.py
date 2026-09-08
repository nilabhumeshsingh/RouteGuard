#!/usr/bin/env python3
"""
iBUS@MUJ WiFi BSSID Mapper - Local Server
Saves each location as a single row with all its BSSIDs as key-value pairs.
"""

import os
import sys
import subprocess
import json
import sqlite3
import datetime
from flask import Flask, send_from_directory, jsonify, request, Response

DB_FILE = "wifi_bssid_map.db"
app = Flask(__name__, static_folder=".", static_url_path="")

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
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

init_db()

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
                
                if bssid in seen_bssids:
                    continue
                
                if "MUJ" in ssid.upper() or "IBUS" in ssid.upper():
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

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

@app.route("/api/scan")
def api_scan():
    rescan = request.args.get("rescan", "false").lower() == "true"
    return jsonify(scan_wifi_chip(rescan=rescan))

@app.route("/api/mappings", methods=["GET"])
def get_mappings():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM locations ORDER BY id DESC").fetchall()
        return jsonify([dict(r) for r in rows])

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

    # Build key-value dictionary and formatted string
    # Key: BSSID, Value: Signal% (with frequency/channel metadata)
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

    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO locations 
            (location, bssid_pairs_text, bssid_pairs_json, count, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (
            location,
            pairs_text,
            pairs_json,
            len(kv_dict),
            now_str
        ))
        conn.commit()

    return jsonify({
        "success": True, 
        "location": location, 
        "count": len(kv_dict), 
        "pairs_text": pairs_text
    })

@app.route("/api/mappings/<int:item_id>", methods=["DELETE"])
def delete_mapping(item_id):
    with get_db() as conn:
        conn.execute("DELETE FROM locations WHERE id = ?", (item_id,))
        conn.commit()
    return jsonify({"success": True, "id": item_id})

@app.route("/api/mappings/clear", methods=["POST"])
def clear_all():
    with get_db() as conn:
        conn.execute("DELETE FROM locations")
        conn.commit()
    return jsonify({"success": True})

@app.route("/api/export/csv")
def export_csv():
    import io
    import csv
    with get_db() as conn:
        rows = conn.execute("SELECT location, bssid_pairs_text, bssid_pairs_json, count, timestamp FROM locations ORDER BY id ASC").fetchall()
        
    output = io.StringIO()
    writer = csv.writer(output)
    # Header: Each location is a single row with all BSSIDs as key-value pairs
    writer.writerow(["Location", "BSSID_Key_Value_Pairs", "BSSID_JSON", "AP_Count", "Timestamp"])
    for r in rows:
        writer.writerow([
            r["location"], 
            r["bssid_pairs_text"], 
            r["bssid_pairs_json"], 
            r["count"], 
            r["timestamp"]
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=muj_wifi_single_row_map_{datetime.date.today()}.csv"}
    )

@app.route("/api/export/json")
def export_json():
    with get_db() as conn:
        rows = conn.execute("SELECT location, bssid_pairs_json, timestamp FROM locations ORDER BY id ASC").fetchall()
    
    result = {}
    for r in rows:
        try:
            result[r["location"]] = json.loads(r["bssid_pairs_json"])
        except Exception:
            result[r["location"]] = r["bssid_pairs_json"]

    return Response(
        json.dumps(result, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment;filename=muj_wifi_kv_map_{datetime.date.today()}.json"}
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"📡 iBUS@MUJ Single-Row Key-Value Server at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
