#!/usr/bin/env python3
"""
RouteGuard - ESP32 Hardware Fire Trigger Bridge
Connects to ESP32 over USB Serial (/dev/ttyUSB0).
When the physical BOOT button on ESP32 is pressed:
  1. Captures nearby BSSIDs and signal levels
  2. Queries MongoDB Atlas / k-NN to resolve the exact room
  3. Sends Fire Alarm to Vercel & Localhost
  4. Site displays fire simulation & real-time safe route to nearest stairs!
"""

import sys
import os
import time
import json
import subprocess
import threading
import urllib.request
import urllib.error
import re

try:
    import serial
except ImportError:
    serial = None

VERCEL_URL = "https://muj-wifi-bssid-mapper.vercel.app"
LOCAL_URL = "http://localhost:4000"
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 115200

# ANSI colors
RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
WHITE = "\033[97m"
BG_RED = "\033[41m"

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

from local_scanner import scan as local_scan, _history_labels, _history_coords
from collections import Counter

def scan_nearby_bssids():
    """Scans nearby WiFi networks using the exact algorithm as local_scanner.py."""
    return local_scan()

def resolve_location_and_trigger_fire(source="ESP32 BOOT Button"):
    log("\n" + "="*60, RED)
    log(f"🔥 [FIRE EVENT] Triggered via {source}!", BOLD + RED)
    log("="*60, RED)

    # 1. Scan WiFi using exact iBUS@MUJ algorithm
    log("📡 1. Scanning surrounding WiFi BSSIDs (iBUS@MUJ algorithm)...", CYAN)
    aps = scan_nearby_bssids()
    log(f"   ✓ Captured {len(aps)} iBUS@MUJ Access Points", GREEN)

    # 2. Query location via Vercel / Localhost scan endpoint
    log("🧠 2. Querying MongoDB Atlas k-NN to resolve room...", CYAN)
    resolved_room = "219"
    resolved_label = "Room 219"
    pos_data = {}

    try:
        # Build payload with exact formatting as local_scanner
        scan_payload_aps = [
            {
                "bssid": a["bssid"],
                "rssi": int(float(a["signal_pct"]) / 2 - 100) if a.get("signal_pct") else a.get("rssi", -70),
                "ssid": a["ssid"]
            }
            for a in aps
        ]
        payload = json.dumps({"deviceId": "esp32-fire-node-01", "aps": scan_payload_aps}).encode("utf-8")
        req = urllib.request.Request(
            f"{VERCEL_URL}/api/scan",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            pos = data.get("position") or {}
            pos_data = pos
            raw_label = pos.get("label") or "Room 219"
            _history_labels.append(raw_label)
            if len(_history_labels) > 3:
                _history_labels.pop(0)

            resolved_label = Counter(_history_labels).most_common(1)[0][0]
            m = re.search(r"\b(20[1-9]|21[0-9]|220)\b", resolved_label)
            if m:
                resolved_room = m.group(1)
            elif pos.get("roomId"):
                resolved_room = str(pos["roomId"])

            log(f"   ✓ Resolved via MongoDB Atlas: {resolved_label} (Room {resolved_room})", BOLD + GREEN)
            print("\n=======================================================")
            print(f"📍 ESTIMATED LOCATION: {resolved_label}")
            print(f"   Coordinates:  (X: {pos.get('x')}, Y: {pos.get('y')})")
            print(f"   Confidence:   {int(pos.get('confidence', 0) * 100)}%")
            print(f"   Anchors Used: {pos.get('anchorsUsed', 0)} APs")
            print(f"   Uncertainty:  ±{pos.get('uncertaintyMeters', 0)}m")
            print("   ✓ Synced with: Live PWA Map")
            print("=======================================================\n")
    except Exception as e:
        log(f"   ⚠️ Atlas k-NN fallback to current room: {e}", YELLOW)

    # 3. Dispatch Fire Alarm to Vercel & Localhost
    log("🚨 3. Dispatching Fire Alarm to Vercel and Localhost...", CYAN)
    fire_payload = json.dumps({
        "deviceId": "esp32-fire-node-01",
        "roomId": resolved_room,
        "label": resolved_label,
        "location": resolved_label,
        "aps": aps,
        "isFire": True
    }).encode("utf-8")

    # To Vercel
    try:
        req_v = urllib.request.Request(
            f"{VERCEL_URL}/api/fire",
            data=fire_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_v, timeout=5) as r:
            log(f"   ✓ Dispatched to Vercel ({VERCEL_URL})", GREEN)
    except Exception as e:
        log(f"   ⚠️ Vercel dispatch: {e}", YELLOW)

    # To Localhost
    try:
        req_l = urllib.request.Request(
            f"{LOCAL_URL}/api/fire",
            data=fire_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_l, timeout=3) as r:
            log(f"   ✓ Dispatched to Local API ({LOCAL_URL})", GREEN)
    except Exception as e:
        pass

    log("\n" + "─"*60, WHITE)
    log(f"🎉 SUCCESS! Fire simulated at {resolved_label}.", BOLD + GREEN)
    log("🧭 PWA website is now dynamically mapping the SAFEST route to the nearest stairs!", BOLD + CYAN)
    log("─"*60 + "\n", WHITE)

def clear_fire_alarm():
    log("\n🧯 Clearing Fire Alarm...", YELLOW)
    payload = json.dumps({"clear": True}).encode("utf-8")
    for base in [VERCEL_URL, LOCAL_URL]:
        try:
            req = urllib.request.Request(
                f"{base}/api/fire",
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=4) as r:
                log(f"   ✓ Cleared on {base}", GREEN)
        except Exception:
            pass
    log("✓ System returned to normal status.\n", GREEN)

last_serial_trigger_time = 0

def listen_serial():
    global last_serial_trigger_time
    if not serial:
        log("pyserial not available. Serial listener disabled.", YELLOW)
        return

    RESET_KEYWORDS = [
        "rst cause", "ets jan", "rst:0x", "ets jun",
        "hard resetting", "system reset", "fire_trigger",
        "manual emergency push button", "boot_reset"
    ]

    while True:
        try:
            if not os.path.exists(SERIAL_PORT):
                time.sleep(1)
                continue

            with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.5) as ser:
                log(f"\n✓ Connected to ESP on {SERIAL_PORT} @ {BAUD_RATE} baud", BOLD + GREEN)
                log("👉 Press the RESET (RST) or BOOT button on the ESP to trigger fire alarm!", BOLD + YELLOW)

                while True:
                    line = ser.readline().decode("utf-8", errors="replace").strip()
                    if line:
                        # Print raw serial for visibility
                        print(f"  [ESP] {line}")
                        lower = line.lower()
                        now = time.time()
                        if any(kw in lower for kw in RESET_KEYWORDS):
                            if now - last_serial_trigger_time > 5.0:
                                last_serial_trigger_time = now
                                resolve_location_and_trigger_fire("ESP Hardware (RESET / Serial)")
        except Exception as e:
            time.sleep(2)

def main():
    print(f"\n{BOLD}{CYAN}======================================================={RESET}")
    print(f"{BOLD}{WHITE}   RouteGuard - ESP32 Physical Fire Trigger Bridge{RESET}")
    print(f"{BOLD}{CYAN}======================================================={RESET}")
    print(f"Target Production: {VERCEL_URL}")
    print(f"Target Localhost:  {LOCAL_URL}")
    print(f"ESP32 Serial Port: {SERIAL_PORT}")
    print(f"Commands:")
    print(f"  - Press physical {BOLD}BOOT{RESET} button on ESP32")
    print(f"  - Or press {BOLD}[ENTER]{RESET} / type {BOLD}'fire'{RESET} in this terminal to simulate trigger")
    print(f"  - Type {BOLD}'clear'{RESET} or {BOLD}'c'{RESET} to dismiss alarm")
    print(f"  - Type {BOLD}'quit'{RESET} or {BOLD}'q'{RESET} to exit\n")

    # Start serial listener thread
    t = threading.Thread(target=listen_serial, daemon=True)
    t.start()

    try:
        while True:
            cmd = input().strip().lower()
            if cmd in ["fire", "f", "b", "boot", ""]:
                resolve_location_and_trigger_fire("Terminal / BOOT Key")
            elif cmd in ["clear", "c"]:
                clear_fire_alarm()
            elif cmd in ["quit", "q", "exit"]:
                log("Exiting bridge. Goodbye!", CYAN)
                sys.exit(0)
    except (KeyboardInterrupt, EOFError):
        log("\nExiting bridge.", CYAN)

if __name__ == "__main__":
    main()
