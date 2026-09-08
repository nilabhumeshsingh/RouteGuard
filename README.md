# RouteGuard
In a fire, every second counts—but indoor GPS doesn't work, smoke blocks exit signs, and panic sets in. Our app, RouteGuard, solves this by turning your building's existing Wi-Fi into a life-saving navigation system. It pinpoints your location indoors, avoids fire and smoke in real-time, and guides you—with voice and vibration—to the safest exit. It even tells rescue teams exactly where you are. We're making buildings smarter and emergencies safer for everyone, especially the most vulnerable.

- **Sense**: Wi-Fi signals and phone sensors identify your exact room and floor.
- **Detect**: Smoke and fire alarms flag dangerous areas on the building map.
- **Route**: The system finds the fastest path that avoids all fire and smoke.
- **Guide**: Spoken directions and vibration pulses navigate you to the exit—even in total darkness.
- **Rescue**: Rescue teams see a live map of everyone still inside.

---

## Wi-Fi BSSID Mapping Engine

This module provides the indoor Wi-Fi fingerprinting cartography tool used to map campus access points and collect signal strength datasets for RouteGuard's indoor localization.

### Features
- **Hardware WiFi Scanning**: Direct Linux `nmcli` integration to scan all visible AP BSSIDs and signal strengths in real time.
- **Single-Row Key-Value Fingerprints**: Maps all detected BSSIDs at a location into a single row under the assigned location name.
- **CSV & JSON Export**: Export collected fingerprints directly for database indexing or Supabase k-NN queries.
- **Fast Minimal UI**: Clean interface focused purely on rapid scanning, location tagging, and export.

### Quick Start

1. Install requirements:
```bash
pip install flask
```

2. Launch local server:
```bash
./run.sh
```
Or directly:
```bash
python3 server.py
```

3. Open `http://localhost:5000` in your browser.

### Data Formats

#### CSV Export
| Location | BSSID_Key_Value_Pairs | BSSID_JSON | AP_Count | Timestamp |
| :--- | :--- | :--- | :--- | :--- |
| AB1 Room 204 | `90:14:AF:5F:B1:10: 77% \| FC:11:65:DF:CB:F0: 100%` | `{"90:14:AF:5F:B1:10": {"signal": "77%"}, ...}` | 25 | 2026-09-08 17:15:00 |

#### JSON Export
```json
{
  "AB1 Room 204": {
    "90:14:AF:5F:B1:10": {
      "signal": "77%",
      "frequency": "5 GHz",
      "channel": "149"
    },
    "FC:11:65:DF:CB:F0": {
      "signal": "100%",
      "frequency": "2.4 GHz",
      "channel": "1"
    }
  }
}
```

### Indoor Positioning with Supabase (k-NN)
The exported JSON structure can be loaded directly into PostgreSQL/Supabase with `jsonb` or `pgvector` to compute Euclidean distance between a live scan and the stored fingerprints:

$$\text{Distance} = \sqrt{\sum (\text{RSSI}_{\text{scan}} - \text{RSSI}_{\text{stored}})^2}$$

The closest location match identifies the user's exact room and floor during an emergency.
