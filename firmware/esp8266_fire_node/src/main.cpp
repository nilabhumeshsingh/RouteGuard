#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// Onboard Button & LED pins on NodeMCU / ESP8266
#define FLASH_BUTTON_PIN 0  // D3 / Flash button (active LOW)
#define LED_PIN          2  // D4 / Built-in LED (active LOW)

const char* WIFI_SSID       = "triggy";
const char* WIFI_PASSWORD   = "pokemon2";
const char* VERCEL_API_URL  = "https://muj-wifi-bssid-mapper.vercel.app/api/fire";
const char* DEVICE_ID       = "esp8266-fire-node-01";

void blinkLed(int times, int ms = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(ms);
    digitalWrite(LED_PIN, HIGH);
    delay(ms);
  }
}

void scanAndDispatchFire() {
  Serial.println("\n=======================================================");
  Serial.println("🔥 [FIRE TRIGGER] Scanning surrounding BSSIDs...");
  Serial.println("=======================================================");

  // Disconnect from AP to scan cleanly
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  Serial.print("📡 Found ");
  Serial.print(n);
  Serial.println(" nearby Access Points.");

  // Build JSON payload
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
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(350);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, LOW); // Solid ON when connected
    Serial.println("\n✓ Connected to WiFi! IP: " + WiFi.localIP().toString());
    Serial.println("🚀 Dispatching survey to Vercel & MongoDB Atlas...");

    WiFiClientSecure client;
    client.setInsecure(); // Bypass SSL cert validation

    HTTPClient http;
    if (http.begin(client, VERCEL_API_URL)) {
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.POST(payload);
      if (httpCode > 0) {
        String resp = http.getString();
        Serial.println("✓ Vercel Response (" + String(httpCode) + "): " + resp);
        Serial.println("🎉 FIRE SIMULATED ON MAP & STAIR EVACUATION PATH ACTIVE!");
        blinkLed(5, 80);
      } else {
        Serial.println("⚠️ HTTP Error: " + http.errorToString(httpCode));
      }
      http.end();
    }
  } else {
    Serial.println("\n⚠️ WiFi connection timeout. Will retry on next trigger.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(FLASH_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // OFF initially

  Serial.println("\n=======================================================");
  Serial.println("   CampusSafe / RouteGuard ESP8266 Fire Node Online   ");
  Serial.println("   Trigger on: RESET (RST) or FLASH (D3) Button       ");
  Serial.println("   WiFi Target: triggy                                ");
  Serial.println("=======================================================");

  // AUTOMATIC SCAN & DISPATCH ON RESET:
  scanAndDispatchFire();
}

void loop() {
  // Trigger whenever the Flash/BOOT button is pressed while running
  if (digitalRead(FLASH_BUTTON_PIN) == LOW) {
    delay(50); // debounce
    if (digitalRead(FLASH_BUTTON_PIN) == LOW) {
      Serial.println("\n[FLASH_BUTTON] Manual trigger pressed!");
      scanAndDispatchFire();
      delay(3000); // cooldown
    }
  }
  delay(100);
}
