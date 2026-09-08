# CampusSafe IoT Fire & Threat Node — Hardware Wiring & Flashing Specification

Hardware reference and flashing guide for the **ESP32-C6 Dedicated Fire Node** (`esp32-fire-node-01`).

---

## 1. System Overview

The Fire Node provides distributed environmental threat monitoring and instant alarm dispatch for **ZONE_FLOOR2_B**. It pairs an ESP32-C6 RISC-V SoC with an MQ-2 combustible gas/smoke ionization sensor, a hardware interrupt test button for live judge demonstrations, and multi-state visual LED status indication.

---

## 2. Pinout Connections Table

| Component | Component Pin / Signal | ESP32-C6 DevKit Pin | Logic Level & Electrical Notes |
| :--- | :--- | :--- | :--- |
| **MQ-2 Gas Sensor** | `VCC` | `5V` / `VIN` | Requires 5.0V for internal heater coil (~150mA). |
| | `GND` | `GND` | Common ground reference. |
| | `AOUT` (Analog Out) | `GPIO 1` (ADC1_CH0) | Max 3.3V safe analog input via voltage divider. |
| | `DOUT` (Digital Out) | *NC* (Not Connected) | Firmware uses high-precision onboard ADC averaging. |
| **Manual Push Button** | Pin 1 (Signal) | `GPIO 4` | Active LOW with internal software pull-up (`INPUT_PULLUP`). |
| | Pin 2 (GND) | `GND` | Direct ground connection. |
| **Onboard RGB (WS2812)** | `DATA_IN` | `GPIO 8` | Onboard addressable NeoPixel on ESP32-C6 DevKit. |
| **External Discrete LED (Optional)** | `RED_ANODE` | `GPIO 5` | Via 220Ω current-limiting resistor. |
| | `GREEN_ANODE` | `GPIO 6` | Via 220Ω current-limiting resistor. |
| | `BLUE_ANODE` | `GPIO 7` | Via 220Ω current-limiting resistor. |
| | `CATHODE` | `GND` | Common cathode to system ground. |

> [!IMPORTANT]
> **MQ-2 Voltage Protection**: The MQ-2 sensor runs on **5V VCC**. Its analog output (`AOUT`) can reach up to 4.5V under heavy smoke. To protect the ESP32-C6 3.3V ADC pin (`GPIO 1`), install a simple two-resistor voltage divider:
> - `AOUT` ➔ **10kΩ Resistor** ➔ `GPIO 1` ➔ **20kΩ Resistor** ➔ `GND`
> - Ratio: `20k / (10k + 20k) = 0.667` (5.0V peak maps safely to 3.33V peak).

---

## 3. Circuit Schematic (ASCII Diagram)

```text
       +-------------------------------------------------------------+
       |                     ESP32-C6 DevKit                         |
       |                                                             |
       |   [5V / VIN] --------+--------------------+                 |
       |                      |                    |                 |
       |   [GND] -------------+---------+          |                 |
       |                      |         |          |                 |
       |   [GPIO 1 (ADC)] ----+         |          |                 |
       |                      |         |          |                 |
       |   [GPIO 4] ----------+         |          |                 |
       |                      |         |          |                 |
       |   [GPIO 8 (WS2812)]  (Onboard) |          |                 |
       +----------------------|---------|----------|-----------------+
                              |         |          |
                              |         |          |
                      +-------+         |          |
                      |                 |          |
           [ 10k Resistor ]             |          |
                      |                 |          |
                      +---> GPIO 1      |          |
                      |                 |          |
           [ 20k Resistor ]             |          |
                      |                 |          |
                      v                 |          |
                     GND                |          |
                                        v          v
                                  +-----------+  +-----------------+
                                  | Push Btn  |  |  MQ-2 Sensor    |
                                  | (Judge)   |  |                 |
                                  |           |  | VCC   <--- 5V   |
                                  | Pin1:GPIO4|  | GND   <--- GND  |
                                  | Pin2: GND |  | AOUT  ---> 10k  |
                                  +-----------+  +-----------------+
```

---

## 4. Visual LED States & Behavior

| State | Visual Indication | Trigger Condition | System Action |
| :--- | :--- | :--- | :--- |
| **Connecting** | **Fast Yellow Blink** (200ms) | Bootup or WiFi disconnected | Exponential backoff retry (1s ➔ 30s) |
| **Monitoring** | **Solid Green** | WiFi connected & ADC < 400 | Continuous sampling (500ms intervals) |
| **Fire Alarm** | **Blinking Red Strobe** (250ms) | ADC ≥ 400 or Button Pressed | Immediate HTTP POST & event buffering |

---

## 5. Flashing Instructions

### Method A: Arduino IDE 2.x (Recommended)

1. **Install ESP32 Board Support Package**:
   - Open **Arduino IDE** > **Settings** (or **Preferences**).
   - In *Additional Boards Manager URLs*, append:
     ```text
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Navigate to **Tools** > **Board** > **Boards Manager**, search for `esp32` by Espressif, and install version **3.0.0** or higher (with ESP32-C6 support).

2. **Select Board & Configuration**:
   - **Board**: `ESP32C6 Dev Module` (or `ESP32 Dev Module` for ESP32-WROOM).
   - **Upload Speed**: `921600` (or `115200` if cable is noisy).
   - **Flash Frequency**: `80MHz`.
   - **Flash Mode**: `QIO`.
   - **USB CDC On Boot**: `Enabled` (for native USB C6 dev boards).
   - **Port**: Select the active `/dev/ttyACM0`, `/dev/ttyUSB0`, or `COMx` port.

3. **Configure Network & Endpoint**:
   - Open `firmware/esp32_fire_node/esp32_fire_node.ino`.
   - Adjust `#define WIFI_SSID`, `WIFI_PASS`, and `SERVER_URL` to match your local router and CampusSafe backend host.

4. **Compile & Upload**:
   - Click **Verify** (checkmark) to compile.
   - Click **Upload** (right arrow). If needed, hold the `BOOT` button on the ESP32 while initiating flash until download begins.
   - Open **Serial Monitor** at **115200 baud** to observe boot diagnostics.

---

### Method B: Command Line (esptool.py / arduino-cli)

#### 1. Compile with `arduino-cli`:
```bash
# Compile for ESP32-C6 target
arduino-cli compile \
  --fqbn esp32:esp32:esp32c6 \
  --output-dir ./build \
  firmware/esp32_fire_node/esp32_fire_node.ino
```

#### 2. Flash via `esptool.py`:
```bash
# Erase flash (recommended for clean install)
esptool.py --chip esp32c6 --port /dev/ttyUSB0 erase_flash

# Flash bootloader, partition table, and application binary
esptool.py --chip esp32c6 --port /dev/ttyUSB0 --baud 921600 \
  --before default_reset --after hard_reset write_flash -z \
  0x0      ./build/esp32_fire_node.ino.bootloader.bin \
  0x8000   ./build/esp32_fire_node.ino.partitions.bin \
  0x10000  ./build/esp32_fire_node.ino.bin
```

---

## 6. Live Judge Testing Procedure

1. **Power-On Verification**:
   - Apply 5V power via USB-C.
   - Watch the LED switch from **Fast Yellow** (WiFi connecting) to **Solid Green** (Monitoring active).

2. **Instant Manual Button Test**:
   - Press the tactile button connected to **GPIO 4**.
   - The LED immediately switches to **Blinking Red Strobe**.
   - The ESP32 outputs `🔘 [MANUAL OVERRIDE] Physical Emergency Button Pressed on GPIO 4!` to Serial and dispatches:
     ```json
     {
       "deviceId": "esp32-fire-node-01",
       "zoneId": "ZONE_FLOOR2_B",
       "kind": "alarm",
       "source": "manual_button",
       "sensorValue": 185,
       "timestamp": 45120
     }
     ```
   - CampusSafe Web UI / RouteGuard updates routes in real time to evacuate students away from **ZONE_FLOOR2_B**.

3. **Sensor Smoke Simulation**:
   - Expose the MQ-2 sensor to combustible vapor (e.g. butane lighter valve unlit or smoke incense).
   - Sensor reading climbs past `THRESHOLD` (400).
   - Alarm triggers automatically and continues dispatching periodic heartbeats until clean air clears the chamber.

4. **Failover Queue Demonstration**:
   - Disconnect the local WiFi router or stop the backend server.
   - Press the manual test button 3 times.
   - Serial confirms events are stored in the internal 10-event circular queue.
   - Reconnect WiFi / restart server.
   - Watch the ESP32 automatically flush all buffered alerts in chronological FIFO order.
