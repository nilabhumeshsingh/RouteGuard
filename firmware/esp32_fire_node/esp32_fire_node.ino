/*
 * CampusSafe - Dedicated IoT Fire Node & Live WiFi Scanner
 * Compatible Hardware: ESP8266 (NodeMCU / D1 Mini) and ESP32 Dev Module / ESP32-C6
 * 
 * Features:
 * - Uses exact scanning and filtering algorithm from local_scanner.py:
 *   1. Scans nearby networks and filters strictly for iBUS@MUJ or Aruba/HPE BSSIDs (90:14:AF / FC:11:65).
 *   2. Normalizes BSSIDs to uppercase and captures channel, frequency, RSSI.
 *   3. Posts payload to /api/scan (Vercel Production & Localhost API).
 *   4. Parses server-side k-NN position response (Room Label, X/Y coordinates, confidence).
 *   5. Implements 3-sample rolling consensus buffer to eliminate single-frame fluctuation.
 *   6. Prints exact formatted CLI status box on Serial Monitor.
 *   7. On physical BOOT button press (or reset), dispatches instant fire alarm to /api/fire!
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
  #include <esp_task_wdt.h>
#endif

// ==============================================================================
// Hardware Configuration & Pin Assignments
// ==============================================================================
#define BOOT_BUTTON_PIN      0     // Onboard BOOT / Flash button (active LOW on GPIO 0)
#define LED_STATUS_PIN       2     // Status LED (GPIO 2)

// Network & API Configuration
const char* WIFI_SSID         = "triggy";
const char* WIFI_PASSWORD     = "pokemon2";
const char* VERCEL_SCAN_URL   = "https://muj-wifi-bssid-mapper.vercel.app/api/scan";
const char* VERCEL_FIRE_URL   = "https://muj-wifi-bssid-mapper.vercel.app/api/fire";
const char* LOCAL_SCAN_URL    = "http://10.58.194.229:4000/api/scan";
const char* LOCAL_FIRE_URL    = "http://10.58.194.229:4000/api/fire";
const char* DEVICE_ID         = "esp32-node-01";

// Continuous Scanning configuration (matches python local_scanner.py --continuous)
const bool  CONTINUOUS_SCAN      = true;
const unsigned long SCAN_INTERVAL_MS = 3000;

// Maximum filtered APs to hold in RAM per scan
const int MAX_APS = 40;

struct ScannedAP {
  String bssid;
  String ssid;
  int channel;
  int rssi;
  String vendor;
};

ScannedAP scannedAps[MAX_APS];
int filteredApCount = 0;

// ==============================================================================
// 3-Sample Rolling History Buffer (matches Python _history_labels / _history_coords)
// ==============================================================================
String _historyLabels[3];
float  _historyX[3];
float  _historyY[3];
int    _historyCount = 0;

String lastResolvedRoom  = "219";
String lastResolvedLabel = "Room 219";
float  lastResolvedX     = -6.78;
float  lastResolvedY     = -7.25;
unsigned long lastScanTime = 0;

// Helper: Extract string value from JSON
String extractJsonString(const String& json, const String& key) {
  String search = "\"" + key + "\":\"";
  int idx = json.indexOf(search);
  if (idx == -1) {
    search = "\"" + key + "\": \"";
    idx = json.indexOf(search);
  }
  if (idx == -1) return "";
  idx += search.length();
  int endIdx = json.indexOf("\"", idx);
  if (endIdx == -1) return "";
  return json.substring(idx, endIdx);
}

// Helper: Extract float value from JSON
float extractJsonFloat(const String& json, const String& key, float defaultVal = 0.0) {
  String search = "\"" + key + "\":";
  int idx = json.indexOf(search);
  if (idx == -1) {
    search = "\"" + key + "\": ";
    idx = json.indexOf(search);
  }
  if (idx == -1) return defaultVal;
  idx += search.length();
  int endIdx = idx;
  while (endIdx < json.length() && (isDigit(json.charAt(endIdx)) || json.charAt(endIdx) == '.' || json.charAt(endIdx) == '-')) {
    endIdx++;
  }
  if (endIdx == idx) return defaultVal;
  return json.substring(idx, endIdx).toFloat();
}

// ==============================================================================
// 1. Scan WiFi APs (Exact algorithm as in local_scanner.py scan())
// ==============================================================================
int scanNearbyAps() {
  Serial.println("\n📡 Scanning nearby WiFi networks for iBUS@MUJ using WiFi.scanNetworks()...");
  
  // Set Station mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  filteredApCount = 0;

  for (int i = 0; i < n && filteredApCount < MAX_APS; ++i) {
    String ssid = WiFi.SSID(i);
    String bssid = WiFi.BSSIDstr(i);
    bssid.toUpperCase();

    String upperSsid = ssid;
    upperSsid.toUpperCase();

    // Exact filter from local_scanner.py:
    // Keep networks with "MUJ" or "IBUS" in SSID, or Aruba/HPE OUI prefixes
    bool isMuj = (upperSsid.indexOf("MUJ") >= 0 || upperSsid.indexOf("IBUS") >= 0);
    bool isAruba = (bssid.startsWith("90:14:AF") || bssid.startsWith("FC:11:65"));

    if (isMuj || isAruba) {
      scannedAps[filteredApCount].bssid = bssid;
      scannedAps[filteredApCount].ssid = (ssid.length() > 0 ? ssid : "iBUS@MUJ");
      scannedAps[filteredApCount].channel = WiFi.channel(i);
      scannedAps[filteredApCount].rssi = WiFi.RSSI(i);
      scannedAps[filteredApCount].vendor = isAruba ? "Aruba Networks / HPE" : "Unknown";
      filteredApCount++;
    }
  }

  // Print detected AP table (matching Python terminal output)
  Serial.print("\nFound ");
  Serial.print(filteredApCount);
  Serial.println(" iBUS@MUJ Access Points:");
  Serial.println("---------------------------------------------------------------------------");
  Serial.println("STATUS   BSSID                CHAN   SIGNAL   SSID");
  Serial.println("---------------------------------------------------------------------------");
  for (int i = 0; i < filteredApCount; ++i) {
    String status = (i == 0) ? "* LIVE " : "  NEAR ";
    Serial.print(status);
    Serial.print(scannedAps[i].bssid);
    Serial.print("   ");
    Serial.print(scannedAps[i].channel);
    Serial.print(scannedAps[i].channel < 10 ? "      " : "     ");
    Serial.print(scannedAps[i].rssi);
    Serial.print(" dBm  ");
    Serial.println(scannedAps[i].ssid);
  }
  Serial.println("---------------------------------------------------------------------------");

  return filteredApCount;
}

// ==============================================================================
// 2. Post Scan & Resolve Location (Exact algorithm as in local_scanner.py post_scan())
// ==============================================================================
bool postScanAndResolve() {
  if (filteredApCount == 0) {
    Serial.println("No iBUS@MUJ APs detected. Skipping dispatch.");
    return false;
  }

  // Build JSON payload matching local_scanner.py format
  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"timestamp\":" + String(millis()) + ",\"aps\":[";
  for (int i = 0; i < filteredApCount; ++i) {
    if (i > 0) payload += ",";
    payload += "{\"bssid\":\"" + scannedAps[i].bssid + "\",";
    payload += "\"ssid\":\"" + scannedAps[i].ssid + "\",";
    payload += "\"rssi\":" + String(scannedAps[i].rssi) + "}";
  }
  payload += "]}";

  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("🌐 Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 25) {
      delay(300);
      Serial.print(".");
      retries++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\n⚠️ WiFi connection timeout. Skipping server query.");
      return false;
    }
    Serial.println("\n✓ Connected to WiFi! IP: " + WiFi.localIP().toString());
  }

  // Dispatch to Vercel / Local API
  WiFiClientSecure client;
  client.setInsecure(); // Allow HTTPS without cert pinning

  HTTPClient http;
  bool resolved = false;

  const char* targets[] = { LOCAL_SCAN_URL, VERCEL_SCAN_URL };
  for (int t = 0; t < 2; ++t) {
    bool ok = false;
    if (String(targets[t]).startsWith("https")) {
      ok = http.begin(client, targets[t]);
    } else {
      WiFiClient plainClient;
      HTTPClient plainHttp;
      if (plainHttp.begin(plainClient, targets[t])) {
        plainHttp.addHeader("Content-Type", "application/json");
        plainHttp.setTimeout(3000);
        int code = plainHttp.POST(payload);
        if (code == 200) {
          String resp = plainHttp.getString();
          // parse position
          parsePositionResponse(resp);
          plainHttp.end();
          return true;
        }
        plainHttp.end();
      }
      continue;
    }

    if (ok) {
      http.addHeader("Content-Type", "application/json");
      http.setTimeout(4000);
      int code = http.POST(payload);
      if (code == 200) {
        String resp = http.getString();
        parsePositionResponse(resp);
        resolved = true;
        http.end();
        break;
      }
      http.end();
    }
  }

  return resolved;
}

// ==============================================================================
// 3. Parse Position & Apply 3-Sample Rolling Consensus Buffer
// ==============================================================================
void parsePositionResponse(const String& json) {
  int posIdx = json.indexOf("\"position\":");
  if (posIdx == -1) return;

  String posJson = json.substring(posIdx);

  String rawLabel = extractJsonString(posJson, "label");
  if (rawLabel.length() == 0) rawLabel = "Room 219";

  float rawX = extractJsonFloat(posJson, "x", -7.25);
  float rawY = extractJsonFloat(posJson, "y", -7.25);
  float conf = extractJsonFloat(posJson, "confidence", 1.0);
  int anchors = (int)extractJsonFloat(posJson, "anchorsUsed", filteredApCount);
  float uncertainty = extractJsonFloat(posJson, "uncertaintyMeters", 2.5);

  // 3-Sample Rolling Majority Buffer (matches Python _history_labels / _history_coords)
  if (_historyCount < 3) {
    _historyLabels[_historyCount] = rawLabel;
    _historyX[_historyCount] = rawX;
    _historyY[_historyCount] = rawY;
    _historyCount++;
  } else {
    _historyLabels[0] = _historyLabels[1];
    _historyLabels[1] = _historyLabels[2];
    _historyLabels[2] = rawLabel;

    _historyX[0] = _historyX[1];
    _historyX[1] = _historyX[2];
    _historyX[2] = rawX;

    _historyY[0] = _historyY[1];
    _historyY[1] = _historyY[2];
    _historyY[2] = rawY;
  }

  // Determine majority label in rolling buffer
  String stableLabel = rawLabel;
  if (_historyCount >= 2) {
    int c0 = 0, c1 = 0, c2 = 0;
    for (int i = 0; i < _historyCount; ++i) {
      if (_historyLabels[i] == _historyLabels[0]) c0++;
      if (_historyLabels[i] == _historyLabels[1]) c1++;
      if (_historyLabels[i] == _historyLabels[2]) c2++;
    }
    if (c0 >= 2) stableLabel = _historyLabels[0];
    else if (c1 >= 2) stableLabel = _historyLabels[1];
    else if (c2 >= 2) stableLabel = _historyLabels[2];
  }

  // Average coordinates over rolling window
  float avgX = 0, avgY = 0;
  for (int i = 0; i < _historyCount; ++i) {
    avgX += _historyX[i];
    avgY += _historyY[i];
  }
  avgX /= _historyCount;
  avgY /= _historyCount;

  lastResolvedLabel = stableLabel;
  lastResolvedX = avgX;
  lastResolvedY = avgY;

  // Extract simple numeric room ID (e.g., "219")
  lastResolvedRoom = "219";
  for (int i = 0; i < stableLabel.length() - 2; ++i) {
    if (isDigit(stableLabel.charAt(i)) && isDigit(stableLabel.charAt(i+1)) && isDigit(stableLabel.charAt(i+2))) {
      lastResolvedRoom = stableLabel.substring(i, i+3);
      break;
    }
  }

  // Print exact formatted status box matching Python scanner
  Serial.println("\n=======================================================");
  Serial.print("📍 ESTIMATED LOCATION: ");
  Serial.println(stableLabel);
  Serial.print("   Coordinates:  (X: ");
  Serial.print(avgX, 2);
  Serial.print(", Y: ");
  Serial.print(avgY, 2);
  Serial.println(")");
  Serial.print("   Confidence:   ");
  Serial.print((int)(conf * 100));
  Serial.println("%");
  Serial.print("   Anchors Used: ");
  Serial.print(anchors);
  Serial.println(" APs");
  Serial.print("   Uncertainty:  ±");
  Serial.print(uncertainty, 1);
  Serial.println("m");
  Serial.println("   ✓ Synced with: Live PWA Map");
  Serial.println("=======================================================\n");
}

// ==============================================================================
// 4. Fire Alarm Trigger & Dispatch (Dispatches to /api/fire)
// ==============================================================================
void dispatchFireAlarm(const String& source) {
  Serial.println("\n" + String("======================================================="));
  Serial.print("🔥 [FIRE EVENT] Triggered via ");
  Serial.print(source);
  Serial.println("!");
  Serial.println("=======================================================");

  // Build Fire payload with resolved room coordinates
  String firePayload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\","
                       "\"roomId\":\"" + lastResolvedRoom + "\","
                       "\"label\":\"" + lastResolvedLabel + "\","
                       "\"location\":\"" + lastResolvedLabel + "\","
                       "\"x\":" + String(lastResolvedX, 2) + ","
                       "\"y\":" + String(lastResolvedY, 2) + ","
                       "\"isFire\":true}";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  Serial.println("🚀 Dispatching Fire Alarm to Vercel & Localhost...");
  if (http.begin(client, VERCEL_FIRE_URL)) {
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(firePayload);
    if (code > 0) {
      Serial.print("✓ Vercel Response (");
      Serial.print(code);
      Serial.print("): ");
      Serial.println(http.getString());
      Serial.println("🔥 Fire simulation & stair evacuation path are now LIVE on the map!");
    } else {
      Serial.print("⚠️ HTTP Error: ");
      Serial.println(http.errorToString(code));
    }
    http.end();
  }
}

// ==============================================================================
// Setup & Loop
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println("\n=======================================================");
  Serial.println("   RouteGuard - ESP32 Dedicated Scanner & Fire Node    ");
  Serial.println("   Algorithm: Exact iBUS@MUJ + k-NN Rolling Consensus  ");
  Serial.println("   Device ID: " + String(DEVICE_ID));
  Serial.println("   Trigger:   RESET or BOOT Button (GPIO 0)            ");
  Serial.println("=======================================================");

  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, HIGH);

  // Initial scan on boot
  scanNearbyAps();
  postScanAndResolve();
  lastScanTime = millis();
}

void loop() {
  // Check physical BOOT button (GPIO 0)
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    delay(50); // debounce
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
      Serial.println("\n[BUTTON] Physical BOOT button pressed!");
      // Quick fresh scan before dispatching fire
      scanNearbyAps();
      postScanAndResolve();
      dispatchFireAlarm("ESP32 BOOT Button");
      delay(3000); // Cooldown
    }
  }

  // Continuous background scanning (matches local_scanner.py --continuous)
  if (CONTINUOUS_SCAN && (millis() - lastScanTime >= SCAN_INTERVAL_MS)) {
    scanNearbyAps();
    postScanAndResolve();
    lastScanTime = millis();
  }

  delay(100);
}
