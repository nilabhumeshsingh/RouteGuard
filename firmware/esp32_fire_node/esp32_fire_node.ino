/*
 * CampusSafe - Dedicated IoT Fire Node
 * Hardware: ESP32 Dev Module + MQ-2 Gas/Smoke Sensor + Push Button + Status LEDs
 * 
 * Features:
 * - WiFi connectivity with exponential backoff retry and hardware task watchdog (WDT)
 * - Analog MQ-2 sensor threshold detection (smoke/combustible gas)
 * - Manual emergency push button with hardware debouncing
 * - Authenticated HTTP POST dispatch to CampusSafe API (/api/devices/events)
 * - Circular failover queue buffering up to 10 events during network degradation
 * - Multi-state LED status indicators (Normal, Alarm, Network Activity)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>

// ==============================================================================
// Hardware Configuration & Pin Assignments
// ==============================================================================
#define MQ2_ANALOG_PIN       34    // ADC1_CH6 (Safe for use with active WiFi)
#define BOOT_BUTTON_PIN      0     // Onboard ESP32 BOOT button (active LOW)
#define BUTTON_PIN           14    // External emergency trigger button (INPUT_PULLUP)
#define LED_NORMAL_PIN       2     // Green LED: System healthy & connected
#define LED_ALARM_PIN        4     // Red LED: Active alarm / smoke detected
#define LED_STATUS_PIN       5     // Yellow/Blue LED: Network transit / pairing

// Thresholds & Constants
#define SMOKE_THRESHOLD_DEFAULT 400
#define WDT_TIMEOUT_SECONDS     10
#define QUEUE_CAPACITY          10
#define DEBOUNCE_DELAY_MS       50
#define SENSOR_SAMPLE_INTERVAL  500
#define ALARM_COOLDOWN_MS       3000
#define MAX_WIFI_RETRY          15

// Network & API Configuration
const char* WIFI_SSID     = "Campus-IoT-Secure";
const char* WIFI_PASSWORD = "CampusSecurePass2026";
const char* API_ENDPOINT  = "http://192.168.1.100:5000/api/devices/events";
const char* API_KEY       = "device-secret-campus-safe-2026";
const char* DEVICE_ID     = "esp32-fire-node-01";
const char* ZONE_ID       = "ZONE_FLOOR2_B";
const char* FLOOR_ID      = "floor-2";

// ==============================================================================
// Event Data Structure & Local Failover Queue
// ==============================================================================
struct FireAlarmEvent {
  char deviceId[32];
  char zoneId[32];
  char floorId[16];
  char kind[16];
  int sensorValue;
  unsigned long timestampMs;
  bool isManualTrigger;
};

class EventFailoverQueue {
private:
  FireAlarmEvent buffer[QUEUE_CAPACITY];
  int head;
  int tail;
  int count;

public:
  EventFailoverQueue() : head(0), tail(0), count(0) {}

  bool enqueue(const FireAlarmEvent& event) {
    if (count >= QUEUE_CAPACITY) {
      // Overwrite oldest entry to keep latest critical events
      head = (head + 1) % QUEUE_CAPACITY;
      count--;
    }
    buffer[tail] = event;
    tail = (tail + 1) % QUEUE_CAPACITY;
    count++;
    return true;
  }

  bool dequeue(FireAlarmEvent& event) {
    if (count == 0) {
      return false;
    }
    event = buffer[head];
    head = (head + 1) % QUEUE_CAPACITY;
    count--;
    return true;
  }

  bool isEmpty() const {
    return count == 0;
  }

  int size() const {
    return count;
  }
};

static EventFailoverQueue failoverQueue;

// ==============================================================================
// State Tracking Variables
// ==============================================================================
enum NodeState {
  STATE_NORMAL,
  STATE_ALARM,
  STATE_DISPATCHING
};

static NodeState currentState = STATE_NORMAL;
static unsigned long lastSensorSampleTime = 0;
static unsigned long lastAlarmDispatchTime = 0;
static int lastButtonState = HIGH;
static int buttonState = HIGH;
static unsigned long lastDebounceTime = 0;
static int smokeThreshold = SMOKE_THRESHOLD_DEFAULT;

// ==============================================================================
// LED Status Management
// ==============================================================================
void updateLedIndicators(NodeState state, bool networkActive = false) {
  switch (state) {
    case STATE_ALARM:
      digitalWrite(LED_NORMAL_PIN, LOW);
      digitalWrite(LED_ALARM_PIN, HIGH);
      digitalWrite(LED_STATUS_PIN, networkActive ? HIGH : LOW);
      break;

    case STATE_DISPATCHING:
      digitalWrite(LED_NORMAL_PIN, LOW);
      digitalWrite(LED_ALARM_PIN, HIGH);
      digitalWrite(LED_STATUS_PIN, HIGH);
      break;

    case STATE_NORMAL:
    default:
      digitalWrite(LED_NORMAL_PIN, HIGH);
      digitalWrite(LED_ALARM_PIN, LOW);
      digitalWrite(LED_STATUS_PIN, networkActive ? HIGH : LOW);
      break;
  }
}

// ==============================================================================
// WiFi Connection with Backoff & Watchdog Feeding
// ==============================================================================
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("[WIFI] Connecting to SSID: " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < MAX_WIFI_RETRY) {
    esp_task_wdt_reset();
    digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN));
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());
    digitalWrite(LED_STATUS_PIN, LOW);
    return true;
  } else {
    Serial.println("\n[WIFI] Connection failed. Operating in offline buffer mode.");
    digitalWrite(LED_STATUS_PIN, LOW);
    return false;
  }
}

// ==============================================================================
// HTTP Event Dispatcher
// ==============================================================================
bool postEventToApi(const FireAlarmEvent& event) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-api-key", API_KEY);

  // Construct JSON payload
  String payload = "{";
  payload += "\"deviceId\":\"" + String(event.deviceId) + "\",";
  payload += "\"zoneId\":\"" + String(event.zoneId) + "\",";
  payload += "\"floorId\":\"" + String(event.floorId) + "\",";
  payload += "\"kind\":\"" + String(event.kind) + "\",";
  payload += "\"sensorValue\":" + String(event.sensorValue) + ",";
  payload += "\"isManualTrigger\":" + String(event.isManualTrigger ? "true" : "false") + ",";
  payload += "\"timestamp\":" + String(millis());
  payload += "}";

  digitalWrite(LED_STATUS_PIN, HIGH);
  int httpResponseCode = http.POST(payload);
  digitalWrite(LED_STATUS_PIN, LOW);

  bool success = false;
  if (httpResponseCode >= 200 && httpResponseCode < 300) {
    Serial.println("[HTTP] Event sent successfully (HTTP " + String(httpResponseCode) + ")");
    success = true;
  } else {
    Serial.println("[HTTP] Post failed, HTTP code: " + String(httpResponseCode) + " Error: " + http.errorToString(httpResponseCode));
  }

  http.end();
  return success;
}

// ==============================================================================
// Event Ingestion & Dispatch Flow
// ==============================================================================
void triggerAlarmEvent(const char* kind, int sensorValue, bool isManual) {
  FireAlarmEvent event;
  strncpy(event.deviceId, DEVICE_ID, sizeof(event.deviceId) - 1);
  strncpy(event.zoneId, ZONE_ID, sizeof(event.zoneId) - 1);
  strncpy(event.floorId, FLOOR_ID, sizeof(event.floorId) - 1);
  strncpy(event.kind, kind, sizeof(event.kind) - 1);
  event.sensorValue = sensorValue;
  event.timestampMs = millis();
  event.isManualTrigger = isManual;

  currentState = STATE_ALARM;
  updateLedIndicators(STATE_ALARM, true);

  Serial.println("[ALARM] Triggered! Kind: " + String(kind) + " Value: " + String(sensorValue));

  // Attempt immediate transmission
  bool sent = false;
  if (WiFi.status() == WL_CONNECTED) {
    sent = postEventToApi(event);
  }

  // If network dispatch failed, buffer locally into failover queue
  if (!sent) {
    failoverQueue.enqueue(event);
    Serial.println("[FAILOVER] Buffered event in failover queue. Queue size: " + String(failoverQueue.size()) + "/" + String(QUEUE_CAPACITY));
  }
}

// Flush pending events in queue when network is restored
void processFailoverQueue() {
  if (failoverQueue.isEmpty() || WiFi.status() != WL_CONNECTED) {
    return;
  }

  Serial.println("[FAILOVER] Flusing buffered events (" + String(failoverQueue.size()) + " remaining)...");
  FireAlarmEvent pendingEvent;
  while (failoverQueue.dequeue(pendingEvent)) {
    esp_task_wdt_reset();
    bool sent = postEventToApi(pendingEvent);
    if (!sent) {
      // Re-enqueue if dispatch still failing
      failoverQueue.enqueue(pendingEvent);
      break;
    }
    delay(100);
  }
}

// ==============================================================================
// Arduino Setup & Loop
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println("=================================================");
  Serial.println(" CampusSafe - IoT Fire Sensor Node Initializing ");
  Serial.println(" Device ID: " + String(DEVICE_ID));
  Serial.println(" Zone:      " + String(ZONE_ID));
  Serial.println("=================================================");

  // Pin initialization
  pinMode(MQ2_ANALOG_PIN, INPUT);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BOOT_BUTTON_PIN, HIGH);
  pinMode(LED_NORMAL_PIN, OUTPUT);
  pinMode(LED_ALARM_PIN, OUTPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);

  updateLedIndicators(STATE_NORMAL);

  // Hardware Task Watchdog initialization
  #if ESP_IDF_VERSION_MAJOR >= 5
    esp_task_wdt_config_t wdt_config = {
      .timeout_ms = WDT_TIMEOUT_SECONDS * 1000,
      .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
      .trigger_panic = true
    };
    esp_task_wdt_init(&wdt_config);
  #else
    esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  #endif
  esp_task_wdt_add(NULL);

  // Connect to WiFi
  connectWiFi();

  Serial.println("[SETUP] Initialization completed successfully.");
}

void loop() {
  // Feed hardware watchdog timer
  esp_task_wdt_reset();

  unsigned long now = millis();

  // 1. Maintain WiFi Connection
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_NORMAL_PIN, LOW);
    if (now % 10000 < 500) {
      connectWiFi();
    }
  }

  // 2. Handle Push Button (BOOT button GPIO 0 or external button GPIO 14) with Debounce
  int reading = (digitalRead(BOOT_BUTTON_PIN) == LOW || digitalRead(BUTTON_PIN) == LOW) ? LOW : HIGH;
  if (reading != lastButtonState) {
    lastDebounceTime = now;
  }

  if ((now - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    if (reading != buttonState) {
      buttonState = reading;
      // Button pressed (Active LOW)
      if (buttonState == LOW && (now - lastAlarmDispatchTime > ALARM_COOLDOWN_MS)) {
        Serial.println("[FIRE_TRIGGER_BOOT_BUTTON] Manual emergency push button triggered!");
        triggerAlarmEvent("alarm", 1023, true);
        lastAlarmDispatchTime = now;
      }
    }
  }
  lastButtonState = reading;

  // 3. Periodic MQ-2 Sensor Sampling
  if (now - lastSensorSampleTime >= SENSOR_SAMPLE_INTERVAL) {
    lastSensorSampleTime = now;
    int rawSmoke = analogRead(MQ2_ANALOG_PIN);

    if (rawSmoke >= smokeThreshold) {
      if (now - lastAlarmDispatchTime > ALARM_COOLDOWN_MS) {
        Serial.println("[SENSOR] Smoke threshold exceeded! Level: " + String(rawSmoke));
        triggerAlarmEvent("alarm", rawSmoke, false);
        lastAlarmDispatchTime = now;
      }
    } else if (currentState == STATE_ALARM && (now - lastAlarmDispatchTime > ALARM_COOLDOWN_MS * 2)) {
      // Return LED to normal if smoke cleared (central API maintains latching state)
      currentState = STATE_NORMAL;
      updateLedIndicators(STATE_NORMAL);
    }
  }

  // 4. Process Any Pending Buffered Events
  if (WiFi.status() == WL_CONNECTED && !failoverQueue.isEmpty()) {
    processFailoverQueue();
  }

  delay(20);
}
