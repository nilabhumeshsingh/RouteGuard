#!/usr/bin/env python3
"""
Raah / CampusSafe - Direct HTTP POST to Vercel
Scans nearby iBUS@MUJ Access Points and dispatches POST to Vercel production.
"""

import sys
import os
import json
import urllib.request
import urllib.error

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from local_scanner import scan

VERCEL_FIRE_URL = "https://muj-wifi-bssid-mapper.vercel.app/api/fire"
VERCEL_SCAN_URL = "https://muj-wifi-bssid-mapper.vercel.app/api/scan"

def main():
    if "--clear" in sys.argv or "clear" in sys.argv:
        print("🧯 Clearing Fire Alarm on Vercel...")
        req = urllib.request.Request(
            VERCEL_FIRE_URL,
            data=json.dumps({"clear": True}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                print("✓ Cleared:", res.read().decode())
        except Exception as e:
            print("Error clearing alarm:", e)
        return

    continuous = "--continuous" in sys.argv or "-c" in sys.argv or "--live" in sys.argv

    while True:
        # 1. Scan WiFi APs using local_scanner algorithm
        print("\n📡 Scanning surrounding iBUS@MUJ Access Points...")
        aps = scan()
        print(f"✓ Found {len(aps)} iBUS@MUJ APs.")

        payload = {
            "deviceId": "esp32-fire-node-01",
            "isFire": True,
            "aps": [
                {
                    "bssid": a["bssid"],
                    "rssi": int(float(a["signal_pct"]) / 2 - 100) if a.get("signal_pct") else a.get("rssi", -70),
                    "ssid": a["ssid"]
                }
                for a in aps
            ]
        }

        print(f"🚀 Sending HTTP POST to Vercel: {VERCEL_FIRE_URL}")
        req = urllib.request.Request(
            VERCEL_FIRE_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=6) as res:
                resp_str = res.read().decode("utf-8")
                data = json.loads(resp_str)
                alarm = data.get("alarm", {})
                print(f"\n=======================================================")
                print(f"🔥 FIRE ALARM POSTED TO VERCEL!")
                print(f"   Status:        ACTIVE")
                print(f"   Resolved Room: {alarm.get('label', 'Room 219')}")
                print(f"   Coordinates:   (X: {alarm.get('x')}, Y: {alarm.get('y')})")
                print(f"   Live URL:      https://muj-wifi-bssid-mapper.vercel.app")
                print(f"=======================================================")
        except Exception as e:
            print("Error sending to Vercel:", e)

        if not continuous:
            print("\nTo clear this alarm later, run: python3 trigger_fire.py --clear\n")
            break

        import time
        time.sleep(2)

if __name__ == "__main__":
    main()
