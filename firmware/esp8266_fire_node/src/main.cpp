#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// Onboard Button & LED pins on NodeMCU / ESP8266
#define FLASH_BUTTON_PIN 0  // D3 / Flash button (active LOW)
#define LED_PIN          2  // D4 / Built-in LED (active LOW)

const char* WIFI_SSID         = "triggy";
const char* WIFI_PASSWORD     = "pokemon2";
const char* VERCEL_SCAN_URL   = "https://muj-wifi-bssid-mapper.vercel.app/api/scan";
const char* VERCEL_FIRE_URL   = "https://muj-wifi-bssid-mapper.vercel.app/api/fire";
const char* LOCAL_SCAN_URL    = "http://10.58.194.229:4000/api/scan";
const char* DEVICE_ID         = "esp8266-fire-node-01";

const bool  CONTINUOUS_SCAN      = true;
const unsigned long SCAN_INTERVAL_MS = 3000;
const int MAX_APS = 30;

struct ScannedAP {
  String bssid;
  String ssid;
  int channel;
  int rssi;
};

ScannedAP scannedAps[MAX_APS];
int filteredApCount = 0;

String _historyLabels[3];
float  _historyX[3];
float  _historyY[3];
int    _historyCount = 0;

String lastResolvedRoom  = "219";
String lastResolvedLabel = "Room 219";
float  lastResolvedX     = -6.78;
float  lastResolvedY     = -7.25;
unsigned long lastScanTime = 0;

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

int scanNearbyAps() {
  Serial.println("\n📡 Scanning nearby WiFi networks for iBUS@MUJ...");
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

    bool isMuj = (upperSsid.indexOf("MUJ") >= 0 || upperSsid.indexOf("IBUS") >= 0);
    bool isAruba = (bssid.startsWith("90:14:AF") || bssid.startsWith("FC:11:65"));

    if (isMuj || isAruba) {
      scannedAps[filteredApCount].bssid = bssid;
      scannedAps[filteredApCount].ssid = (ssid.length() > 0 ? ssid : "iBUS@MUJ");
      scannedAps[filteredApCount].channel = WiFi.channel(i);
      scannedAps[filteredApCount].rssi = WiFi.RSSI(i);
      filteredApCount++;
    }
  }

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

  lastResolvedRoom = "219";
  for (int i = 0; i < stableLabel.length() - 2; ++i) {
    if (isDigit(stableLabel.charAt(i)) && isDigit(stableLabel.charAt(i+1)) && isDigit(stableLabel.charAt(i+2))) {
      lastResolvedRoom = stableLabel.substring(i, i+3);
      break;
    }
  }

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

bool postScanAndResolve() {
  if (filteredApCount == 0) return false;

  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"timestamp\":" + String(millis()) + ",\"aps\":[";
  for (int i = 0; i < filteredApCount; ++i) {
    if (i > 0) payload += ",";
    payload += "{\"bssid\":\"" + scannedAps[i].bssid + "\",";
    payload += "\"ssid\":\"" + scannedAps[i].ssid + "\",";
    payload += "\"rssi\":" + String(scannedAps[i].rssi) + "}";
  }
  payload += "]}";

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 25) {
      delay(300);
      retries++;
    }
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, VERCEL_SCAN_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000);
    int code = http.POST(payload);
    if (code == 200) {
      parsePositionResponse(http.getString());
      http.end();
      return true;
    }
    http.end();
  }
  return false;
}

void dispatchFireAlarm(const String& source) {
  Serial.println("\n🔥 [FIRE EVENT] Triggered via " + source + "!");
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

  if (http.begin(client, VERCEL_FIRE_URL)) {
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(firePayload);
    if (code > 0) {
      Serial.println("✓ Fire Alarm Dispatched! Evacuation active on Live PWA Map!");
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(FLASH_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  Serial.println("\n=======================================================");
  Serial.println("   CampusSafe / RouteGuard ESP8266 Fire Node Online   ");
  Serial.println("   Exact iBUS@MUJ Scan & Rolling Consensus Active     ");
  Serial.println("=======================================================");

  scanNearbyAps();
  postScanAndResolve();
  lastScanTime = millis();
}

void loop() {
  if (digitalRead(FLASH_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(FLASH_BUTTON_PIN) == LOW) {
      scanNearbyAps();
      postScanAndResolve();
      dispatchFireAlarm("ESP8266 Flash Button");
      delay(3000);
    }
  }

  if (CONTINUOUS_SCAN && (millis() - lastScanTime >= SCAN_INTERVAL_MS)) {
    scanNearbyAps();
    postScanAndResolve();
    lastScanTime = millis();
  }

  delay(100);
}
