/*
 * CampusSafe - Dedicated IoT Fire Node
 * Compatible Hardware: ESP8266 (NodeMCU / D1 Mini) and ESP32 Dev Module
 * 
 * Features:
 * - Trigger on RESET / BOOT: Automatically scans surrounding WiFi BSSIDs on boot
 * - Ingests network credentials for "triggy" / "pokemon2"
 * - Dispatches BSSID survey payload to Vercel API (/api/fire) and MongoDB Atlas
 * - Backend maps BSSIDs to exact room, triggers fire alarm, and plots safest stair evacuation path!
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
#define BOOT_BUTTON_PIN      0     // Onboard BOOT button (active LOW on GPIO 0)
#define LED_NORMAL_PIN       2     // Status LED

// Network & API Configuration (User's Network Credentials)
const char* WIFI_SSID     = "triggy";
const char* WIFI_PASSWORD = "pokemon2";
const char* VERCEL_API_URL = "https://muj-wifi-bssid-mapper.vercel.app/api/fire";
const char* LOCAL_API_URL  = "http://10.58.194.229:4000/api/fire";
const char* DEVICE_ID     = "esp-fire-node-01";

// ==============================================================================
// BSSID WiFi Scanning & Fire Event Dispatcher
// ==============================================================================
void scanAndDispatchFire() {
  Serial.println("\n🔥 [FIRE DETECTED] Performing WiFi survey of current location...");

  // Set WiFi to Station mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  Serial.print("📡 Found ");
  Serial.print(n);
  Serial.println(" nearby Access Points.");

  // Build JSON payload with scanned BSSIDs and signal strengths
  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"isFire\":true,\"aps\":[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) payload += ",";
    payload += "{\"bssid\":\"" + WiFi.BSSIDstr(i) + "\",";
    payload += "\"ssid\":\"" + WiFi.SSID(i) + "\",";
    payload += "\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  payload += "]}";

  Serial.println("🌐 Connecting to WiFi: " + String(WIFI_SSID) + "...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(400);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ Connected to WiFi! IP: " + WiFi.localIP().toString());
    Serial.println("🚀 Dispatching BSSID data to Vercel & MongoDB Atlas...");

    WiFiClientSecure client;
    client.setInsecure(); // Allow HTTPS without cert validation

    HTTPClient http;
    if (http.begin(client, VERCEL_API_URL)) {
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.POST(payload);
      if (httpCode > 0) {
        String response = http.getString();
        Serial.println("✓ Vercel Response (" + String(httpCode) + "): " + response);
        Serial.println("🔥 Fire simulation and stair evacuation path are now LIVE on the map!");
      } else {
        Serial.println("⚠️ HTTP error: " + http.errorToString(httpCode));
      }
      http.end();
    }
  } else {
    Serial.println("\n⚠️ Could not connect to WiFi. Serial listener on laptop will handle fallback.");
  }
}

// ==============================================================================
// Setup & Loop
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("\n=================================================");
  Serial.println(" RouteGuard - ESP Hardware Fire Node Initialized ");
  Serial.println(" Device ID: " + String(DEVICE_ID));
  Serial.println(" Trigger:   RESET or BOOT Button");
  Serial.println("=================================================");

  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_NORMAL_PIN, OUTPUT);

  // AUTOMATIC TRIGGER ON RESET:
  // Whenever the user clicks the RESET (RST) button, setup() executes:
  scanAndDispatchFire();
}

void loop() {
  // Also check if BOOT button (GPIO 0) is pressed while running
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    delay(50); // debounce
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
      Serial.println("\n[BUTTON] Physical BOOT button pressed!");
      scanAndDispatchFire();
      delay(3000); // cooldown
    }
  }
  delay(100);
}
