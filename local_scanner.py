#!/usr/bin/env python3
"""
iBUS@MUJ WiFi AP Scanner (CLI Utility)
Dumps live detected iBUS@MUJ BSSIDs to CSV or JSON
"""

import sys
import subprocess
import csv
import json
import datetime

def scan():
    print("📡 Scanning nearby WiFi networks for iBUS@MUJ using nmcli...")
    cmd = [
        "nmcli", "-t", "-f",
        "IN-USE,BSSID,SSID,MODE,CHAN,FREQ,RATE,SIGNAL,SECURITY",
        "dev", "wifi", "list"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    lines = res.stdout.strip().split("\n")
    
    aps = []
    for line in lines:
        if not line:
            continue
        parts = line.split(":")
        if len(parts) >= 8:
            in_use = parts[0].strip() == "*"
            bssid = ":".join(parts[1:7]).replace("\\", "").upper()
            rest = parts[7:]
            ssid = rest[0]
            if "MUJ" in ssid.upper() or "IBUS" in ssid.upper():
                chan = rest[2] if len(rest) > 2 else ""
                freq = rest[3] if len(rest) > 3 else ""
                rate = rest[4] if len(rest) > 4 else ""
                sig = rest[5] if len(rest) > 5 else "80"
                aps.append({
                    "bssid": bssid,
                    "ssid": ssid,
                    "in_use": in_use,
                    "channel": chan,
                    "frequency": freq,
                    "rate": rate,
                    "signal_pct": sig,
                    "vendor": "Aruba Networks / HPE" if bssid.startswith(("90:14:AF", "FC:11:65")) else "Unknown",
                    "scanned_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
    return aps

def export_csv(aps, filename="muj_wifi_scan.csv"):
    if not aps:
        print("No APs found.")
        return
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(aps[0].keys()))
        writer.writeheader()
        writer.writerows(aps)
    print(f"✓ Exported {len(aps)} APs to {filename}")

def post_scan(aps, url="http://localhost:4000/api/scan", device_id="laptop-1"):
    import urllib.request
    import urllib.error
    
    payload = {
        "deviceId": device_id,
        "timestamp": int(datetime.datetime.now().timestamp() * 1000),
        "aps": [
            {
                "bssid": a["bssid"],
                "rssi": int(float(a["signal_pct"]) / 2 - 100) if a["signal_pct"] else -70,
                "ssid": a["ssid"]
            }
            for a in aps
        ]
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
            pos = data.get("position")
            if pos:
                print("\n=======================================================")
                print(f"📍 ESTIMATED LOCATION: {pos.get('label', 'Unknown')}")
                print(f"   Coordinates:  (X: {pos.get('x')}, Y: {pos.get('y')})")
                print(f"   Confidence:   {int(pos.get('confidence', 0) * 100)}%")
                print(f"   Anchors Used: {pos.get('anchorsUsed', 0)} APs")
                print(f"   Uncertainty:  ±{pos.get('uncertaintyMeters', 0)}m")
                print("=======================================================\n")
            else:
                print("Scan posted. No confident location found.")
            return data
    except Exception as e:
        print(f"Could not reach {url}: {e}")
        return None

if __name__ == "__main__":
    import time
    
    continuous = "-c" in sys.argv or "--continuous" in sys.argv or "--live" in sys.argv
    device_id = "laptop-1"
    url = "http://localhost:4000/api/scan"
    
    for i, arg in enumerate(sys.argv):
        if arg in ("--device", "-d") and i + 1 < len(sys.argv):
            device_id = sys.argv[i + 1]
        elif arg in ("--url", "-u") and i + 1 < len(sys.argv):
            url = sys.argv[i + 1]

    while True:
        aps = scan()
        print(f"\nFound {len(aps)} iBUS@MUJ Access Points:")
        print("-" * 75)
        print(f"{'STATUS':<8} {'BSSID':<20} {'CHAN':<6} {'FREQ':<12} {'SIGNAL':<8} {'RATE'}")
        print("-" * 75)
        for ap in aps:
            status = "* LIVE" if ap["in_use"] else "  NEAR"
            print(f"{status:<8} {ap['bssid']:<20} {ap['channel']:<6} {ap['frequency']:<12} {ap['signal_pct'] + '%':<8} {ap['rate']}")
        print("-" * 75)

        if "--csv" in sys.argv:
            export_csv(aps)

        # Query location from MongoDB via API
        post_scan(aps, url=url, device_id=device_id)

        if not continuous:
            break
        time.sleep(2)

