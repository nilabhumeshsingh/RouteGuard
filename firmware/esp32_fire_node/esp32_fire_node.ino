/*
 * CampusSafe / Raah - ESP32 Dedicated IoT Fire Node
 * Direct HTTP POST to Vercel Production
 *
 * Algorithm:
 * - Scans nearby WiFi networks and filters strictly for iBUS@MUJ or Aruba BSSIDs
 *   (exact same filter as local_scanner.py).
 * - Dispatches HTTP POST with scanned BSSIDs directly to Vercel (/api/fire).
 * - Backend maps BSSIDs to exact room (Room 219), triggers alarm, and routes occupants to safe stairs!
 * - Triggered automatically on BOOT/RESET or whenever the BOOT button (GPIO 0) is pressed.
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
#endif

// ==============================================================================
// Configuration
// ==============================================================================
#define BOOT_BUTTON_PIN      0     // Onboard BOOT / Flash button (active LOW on GPIO 0)
#define LED_PIN              2     // Status LED (GPIO 2)

// Network credentials & Vercel Production URL
const char* WIFI_SSID       = "triggy";
const char* WIFI_PASSWORD   = "pokemon2";
const char* VERCEL_URL      = "https://muj-wifi-bssid-mapper.vercel.app/api/fire";
const char* DEVICE_ID       = "esp32-fire-node-01";

// Continuous POST mode: scans and posts to Vercel on repeat
const bool CONTINUOUS_POST           = true;
const unsigned long POST_INTERVAL_MS = 3000;
unsigned long lastPostTime           = 0;

// ==============================================================================
// WiFi Scan & Direct HTTP POST to Vercel
// ==============================================================================
void scanAndPostToVercel() {
  Serial.println("\n🔥 [FIRE TRIGGER] Scanning surrounding iBUS@MUJ Access Points...");

  // Disconnect briefly to scan cleanly
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  Serial.print("📡 Scanned ");
  Serial.print(n);
  Serial.println(" total networks.");

  // Build JSON payload with exact iBUS@MUJ filtering matching local_scanner.py
  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"isFire\":true,\"aps\":[";
  int matched = 0;

  for (int i = 0; i < n; ++i) {
    String ssid = WiFi.SSID(i);
    String bssid = WiFi.BSSIDstr(i);
    bssid.toUpperCase();

    String upperSsid = ssid;
    upperSsid.toUpperCase();

    // Exact filtering from python script:
    bool isMuj = (upperSsid.indexOf("MUJ") >= 0 || upperSsid.indexOf("IBUS") >= 0);
    bool isAruba = (bssid.startsWith("90:14:AF") || bssid.startsWith("FC:11:65"));

    if (isMuj || isAruba) {
      if (matched > 0) payload += ",";
      payload += "{\"bssid\":\"" + bssid + "\",";
      payload += "\"ssid\":\"" + (ssid.length() > 0 ? ssid : "iBUS@MUJ") + "\",";
      payload += "\"rssi\":" + String(WiFi.RSSI(i)) + "}";
      matched++;
    }
  }
  payload += "]}";

  Serial.print("✓ Captured ");
  Serial.print(matched);
  Serial.println(" iBUS@MUJ Access Points.");

  // Connect to WiFi
  Serial.print("🌐 Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(300);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("\n✓ Connected to WiFi! IP: " + WiFi.localIP().toString());
    Serial.print("🚀 Sending HTTP POST to Vercel: ");
    Serial.println(VERCEL_URL);

    WiFiClientSecure client;
    client.setInsecure(); // SSL cert bypass

    HTTPClient http;
    if (http.begin(client, VERCEL_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.setTimeout(6000);
      int httpCode = http.POST(payload);

      if (httpCode > 0) {
        String resp = http.getString();
        Serial.print("✓ Vercel Response (");
        Serial.print(httpCode);
        Serial.print("): ");
        Serial.println(resp);
        Serial.println("🔥 SUCCESS! Fire alarm is now LIVE on https://muj-wifi-bssid-mapper.vercel.app");
      } else {
        Serial.print("⚠️ HTTP Error: ");
        Serial.println(http.errorToString(httpCode));
      }
      http.end();
    }
  } else {
    Serial.println("\n⚠️ Could not connect to WiFi.");
  }
}

// ==============================================================================
// Setup & Loop
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n=======================================================");
  Serial.println("   Raah / CampusSafe - ESP32 Direct Vercel Fire Node  ");
  Serial.println("   Trigger: RESET (RST) or BOOT Button (GPIO 0)        ");
  Serial.println("=======================================================");

  // Automatically scan and POST to Vercel on boot/reset
  scanAndPostToVercel();
}

void loop() {
  // Check physical BOOT button (GPIO 0)
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    delay(50); // debounce
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
      Serial.println("\n[BUTTON] BOOT button pressed!");
      scanAndPostToVercel();
      lastPostTime = millis();
      delay(2000); // cooldown
    }
  }

  // Continuous background POST loop
  if (CONTINUOUS_POST && (millis() - lastPostTime >= POST_INTERVAL_MS)) {
    scanAndPostToVercel();
    lastPostTime = millis();
  }

  delay(100);
}
