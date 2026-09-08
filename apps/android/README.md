# CampusSafe / RouteGuard — Native Android Scanner App

Production-grade native Android scanner application (`com.routeguard.scanner`) for continuous indoor Wi-Fi BSSID fingerprint positioning and real-time PWA synchronization.

---

## 1. Overview & Architecture

While progressive web apps (PWAs) running in standard mobile browsers cannot access raw Wi-Fi BSSID frames due to Web API security sandboxing, this native Android Kotlin application directly interfaces with Android's `WifiManager` to capture physical 2.4 GHz and 5 GHz signals and dispatch them to the positioning engine.

```
┌────────────────────────────────────────────────────────┐
│             CampusSafe Android Scanner App             │
├──────────────────────────┬─────────────────────────────┤
│   Native Kotlin Layer    │   Embedded Hybrid WebView   │
│                          │                             │
│ • Android WifiManager    │ • React 19 + Vite PWA       │
│ • BSSID/RSSI Ingestion   │ • Vector 2D SVG Floorplan   │
│ • Channel Computation    │ • Turn-by-Turn Guidance     │
│ • OkHttp HTTPS Client    │ • Frosted Glass Apple UI    │
│                          │                             │
│       │ POST /api/       │            ▲                │
│       │ position/        │            │ JavaScript     │
│       ▼ estimate         │            │ Bridge         │
└───────┬──────────────────┴────────────┴────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│     Cloud Backend (Vercel Serverless / Express)        │
│                                                        │
│ • Weighted k-NN Estimator (k=3, 5, 7)                  │
│ • Cosine Similarity Signal Comparison                  │
│ • Corridor Polyline Map-Matching Snapping              │
│ • Response: { x, y, floorId, nearestPlaceName }        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

1. **Dual-Band Wi-Fi Scanner (`WifiScannerService.kt`)**:
   - Captures `BSSID`, `RSSI` (dBm), `Frequency` (MHz), and derives Wi-Fi channel numbers for both 2.4 GHz (channels 1–14) and 5 GHz bands (channels 36–165).
   - Handles Android 9+ (API 28+) Wi-Fi scan throttling gracefully via cached result fallbacks and broadcast receiver callbacks.
   - Built-in synthetic fallback mode for testing in Android Emulators without physical Wi-Fi hardware.

2. **Vercel & Localhost Dispatcher (`PositionApiClient.kt`)**:
   - Dispatches fingerprint payloads over HTTPS to `https://routeguard.vercel.app/api/position/estimate` or customizable local IP endpoints.
   - Measures network round-trip latency (ms) and reports telemetry directly on the status bar.

3. **Bi-directional WebApp Bridge (`WebAppInterface.kt`)**:
   - Injects the native scanner instance as `window.AndroidBridge` inside the embedded PWA WebView.
   - Pushes live estimated coordinates `(x, y, floorId, uncertaintyRadius)` into the React DOM state so the pulsing user dot moves in real-time.

4. **Apple-Inspired Native Drawer**:
   - One-tap toggle between **Vercel Cloud** and **Localhost** (`10.0.2.2:4000` / `10.58.194.229:4000`).
   - Collapsible control card minimizing to a pill badge for full-screen map viewing.

---

## 3. Required Android Permissions

The application requests the following permissions in `AndroidManifest.xml`:
- `android.permission.INTERNET`: For POSTing fingerprints to Vercel cloud and loading the PWA.
- `android.permission.ACCESS_NETWORK_STATE`: For checking connectivity.
- `android.permission.ACCESS_WIFI_STATE`: For reading Wi-Fi AP scan results.
- `android.permission.CHANGE_WIFI_STATE`: For initiating `wifiManager.startScan()`.
- `android.permission.ACCESS_FINE_LOCATION`: Required by Android OS to access Wi-Fi BSSID identifiers.

---

## 4. API Request & Response Contract

### Request: `POST /api/position/estimate`
```json
{
  "fingerprints": [
    {
      "bssid": "20:e8:82:7e:24:d0",
      "rssi": -62,
      "frequency": 2412,
      "channel": 1,
      "ssid": "CAMPUS_SECURE"
    },
    {
      "bssid": "00:27:0d:3e:ab:22",
      "rssi": -67,
      "frequency": 2437,
      "channel": 6,
      "ssid": "CAMPUS_GUEST"
    }
  ],
  "previousPosition": {
    "x": 120.0,
    "y": 220.0,
    "floorId": "floor-2"
  }
}
```

### Response: `200 OK`
```json
{
  "x": 124.5,
  "y": 218.2,
  "floorId": "floor-2",
  "uncertaintyRadius": 2.1,
  "nearestPlaceName": "AB1 Room 204",
  "confidence": 0.89,
  "calculationMethod": "knn-weighted",
  "timestamp": 1725805200000
}
```

---

## 5. Building & Running

### Option A: Via Android Studio
1. Open Android Studio.
2. Select **Open** and choose the `apps/android` directory.
3. Allow Gradle to sync dependencies (`OkHttp`, `Gson`, `Material`, `WebKit`).
4. Select target device (physical Android phone with Developer Options enabled, or Android Emulator).
5. Click **Run** (`Shift + F10`).

### Option B: Via Command Line (Gradle Wrapper)
```bash
cd apps/android
./gradlew assembleDebug
```
The compiled APK will be located at:
```
apps/android/app/build/outputs/apk/debug/app-debug.apk
```

### Option C: Sideloading via ADB
```bash
adb install -r apps/android/app/build/outputs/apk/debug/app-debug.apk
```
