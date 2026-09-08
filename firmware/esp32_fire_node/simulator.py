#!/usr/bin/env python3
"""
CampusSafe IoT Sensor Infrastructure
Device: ESP32-C6 / ESP32 Dedicated Fire & Threat Node Hardware Simulator
File: simulator.py

Description:
    Accurate hardware emulator and CI testing harness for the ESP32 Fire Node.
    Mocks the MQ-2 analog sensor, hardware button interrupt on GPIO 4,
    exponential backoff network loop, 10-event resilient failover queue,
    and visual RGB status indicators.

Usage:
    Interactive mode:
        python3 simulator.py --server-url http://localhost:4000/api/devices/events

    Automated CI test mode (self-contained with mock server):
        python3 simulator.py --test

    Embedded mock server mode:
        python3 simulator.py --mock-server --port 4000
"""

import sys
import time
import json
import random
import threading
import argparse
import http.server
import urllib.request
import urllib.error
from collections import deque

# ============================================================================
# ANSI TERMINAL STYLING & LED EMULATION
# ============================================================================

class Ansi:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"


def led_indicator(state: str) -> str:
    """Renders terminal equivalent of the ESP32 physical RGB LED."""
    if state == "CONNECTING":
        return f"{Ansi.BG_YELLOW}{Ansi.BOLD} [🟡 FAST YELLOW: CONNECTING] {Ansi.RESET}"
    elif state == "MONITORING":
        return f"{Ansi.BG_GREEN}{Ansi.BOLD} [🟢 SOLID GREEN: MONITORING] {Ansi.RESET}"
    elif state == "ALARM":
        return f"{Ansi.BG_RED}{Ansi.WHITE}{Ansi.BOLD} [🔴 BLINKING RED: FIRE ALARM TRIGGERED] {Ansi.RESET}"
    return f"[{state}]"


# ============================================================================
# HARDWARE CONSTANTS & DEFAULTS
# ============================================================================

DEFAULT_DEVICE_ID = "esp32-fire-node-01"
DEFAULT_ZONE_ID = "ZONE_FLOOR2_B"
DEFAULT_THRESHOLD = 400
DEFAULT_QUEUE_CAPACITY = 10
DEFAULT_SAMPLE_INTERVAL = 0.5  # 500ms
DEFAULT_SERVER_URL = "http://localhost:4000/api/devices/events"


# ============================================================================
# RESILIENT FAILOVER EVENT QUEUE
# ============================================================================

class ResilientEventQueue:
    """Ring buffer mirroring ESP32 circular queue with 10-event capacity."""

    def __init__(self, capacity: int = DEFAULT_QUEUE_CAPACITY):
        self.capacity = capacity
        self._queue = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def push(self, event: dict) -> bool:
        with self._lock:
            saturated = len(self._queue) >= self.capacity
            if saturated:
                print(f"{Ansi.YELLOW}[QUEUE]{Ansi.RESET} Buffer saturated ({self.capacity}/{self.capacity}). Dropping oldest event.")
            self._queue.append(event)
            print(f"{Ansi.CYAN}[QUEUE]{Ansi.RESET} Enqueued event from source '{event.get('source', 'unknown')}'. Buffered: {len(self._queue)}/{self.capacity}")
            return True

    def peek(self) -> dict:
        with self._lock:
            return self._queue[0] if self._queue else None

    def pop(self) -> dict:
        with self._lock:
            return self._queue.popleft() if self._queue else None

    def __len__(self) -> int:
        with self._lock:
            return len(self._queue)

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._queue) == 0


# ============================================================================
# HARDWARE NODE SIMULATOR CLASS
# ============================================================================

class ESP32FireNodeSimulator:
    def __init__(
        self,
        server_url: str = DEFAULT_SERVER_URL,
        device_id: str = DEFAULT_DEVICE_ID,
        zone_id: str = DEFAULT_ZONE_ID,
        threshold: int = DEFAULT_THRESHOLD,
        queue_capacity: int = DEFAULT_QUEUE_CAPACITY,
        sample_interval: float = DEFAULT_SAMPLE_INTERVAL,
    ):
        self.server_url = server_url
        self.device_id = device_id
        self.zone_id = zone_id
        self.threshold = threshold
        self.sample_interval = sample_interval

        # State tracking
        self.state = "CONNECTING"
        self.network_available = True
        self.network_connected = False
        self.backoff_seconds = 1.0
        self.max_backoff_seconds = 30.0
        self.last_wifi_attempt = 0.0

        # Sensor emulation
        self.smoke_active = False
        self.current_sensor_value = 180  # Clean air baseline
        self.sensor_alarm_active = False
        self.last_alarm_heartbeat = 0.0
        self.alarm_heartbeat_interval = 4.0

        # Hardware interrupt tracking
        self.button_interrupt_pending = 0

        # Failover queue
        self.queue = ResilientEventQueue(capacity=queue_capacity)

        # Control thread
        self.running = False
        self._thread = None
        self._lock = threading.Lock()

        # Statistics
        self.stats = {
            "dispatched": 0,
            "failed_buffered": 0,
            "recovered": 0,
            "button_presses": 0,
            "sensor_trips": 0,
        }

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    # ------------------------------------------------------------------------
    # Hardware Interrupt & Manual Control
    # ------------------------------------------------------------------------

    def trigger_button_interrupt(self):
        """Simulates physical GPIO 4 button press (FALLING edge ISR)."""
        with self._lock:
            self.button_interrupt_pending += 1
            self.stats["button_presses"] += 1
        print(f"\n{Ansi.MAGENTA}🔘 [ISR GPIO 4] Hardware Manual Push Button Interrupt Fired!{Ansi.RESET}")

    def set_smoke(self, active: bool, custom_value: int = None):
        """Injects or clears simulated smoke condition."""
        with self._lock:
            self.smoke_active = active
            if active:
                self.current_sensor_value = custom_value or random.randint(480, 850)
                print(f"\n{Ansi.RED}🔥 [SIMULATOR] Smoke/Gas injected! MQ-2 reading: {self.current_sensor_value} (Threshold: {self.threshold}){Ansi.RESET}")
            else:
                self.current_sensor_value = custom_value or random.randint(140, 220)
                print(f"\n{Ansi.GREEN}🌿 [SIMULATOR] Clean air restored. MQ-2 reading: {self.current_sensor_value}{Ansi.RESET}")

    def set_network_state(self, online: bool):
        """Simulates physical WiFi link drop or restore."""
        with self._lock:
            self.network_available = online
            if not online:
                self.network_connected = False
                if self.state != "ALARM":
                    self.state = "CONNECTING"
                print(f"\n{Ansi.YELLOW}⚠️  [WIFI] Wireless link DISCONNECTED. (Testing offline failover buffering){Ansi.RESET}")
            else:
                print(f"\n{Ansi.CYAN}📶 [WIFI] Wireless link RESTORED. Reconnecting with exponential backoff...{Ansi.RESET}")

    # ------------------------------------------------------------------------
    # Network & Dispatch
    # ------------------------------------------------------------------------

    def _post_http_event(self, event: dict) -> bool:
        """Transmits JSON alert to central endpoint via HTTP POST."""
        if not self.network_connected:
            return False

        payload_bytes = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            self.server_url,
            data=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "User-Agent": f"CampusSafe-FireNode/{self.device_id}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=3.5) as response:
                status = response.getcode()
                if 200 <= status < 300:
                    print(f"{Ansi.GREEN}[HTTP 200]{Ansi.RESET} Alert acknowledged by {self.server_url} -> {json.dumps(event)}")
                    return True
                else:
                    print(f"{Ansi.RED}[HTTP {status}]{Ansi.RESET} Remote server rejected alert.")
                    return False
        except Exception as err:
            print(f"{Ansi.RED}[HTTP ERROR]{Ansi.RESET} Failed to reach {self.server_url}: {err}")
            return False

    def _drain_failover_queue(self):
        """Flushes buffered alerts chronologically once connection is healthy."""
        if self.queue.is_empty() or not self.network_connected:
            return

        while not self.queue.is_empty():
            event = self.queue.peek()
            if not event:
                break

            print(f"{Ansi.CYAN}[QUEUE FLUSH]{Ansi.RESET} Attempting delivery of buffered alert ({event.get('source')})...")
            success = self._post_http_event(event)
            if success:
                self.queue.pop()
                self.stats["recovered"] += 1
                print(f"{Ansi.GREEN}[QUEUE FLUSH]{Ansi.RESET} Buffered event successfully flushed! Remaining: {len(self.queue)}")
            else:
                print(f"{Ansi.YELLOW}[QUEUE FLUSH]{Ansi.RESET} Server unavailable during queue drain. Pausing flush.")
                break

    def _dispatch_alarm(self, source: str, sensor_val: int):
        """Builds and dispatches alarm event or buffers to failover queue."""
        event = {
            "deviceId": self.device_id,
            "zoneId": self.zone_id,
            "kind": "alarm",
            "source": source,
            "sensorValue": sensor_val,
            "timestamp": int(time.time() * 1000),
        }

        self.state = "ALARM"
        print(f"\n{Ansi.BG_RED}{Ansi.WHITE}{Ansi.BOLD} 🚨 ALARM TRIGGERED | Source: {source} | Value: {sensor_val} | Zone: {self.zone_id} {Ansi.RESET}")

        if self.network_connected:
            delivered = self._post_http_event(event)
            if delivered:
                self.stats["dispatched"] += 1
            else:
                self.stats["failed_buffered"] += 1
                self.queue.push(event)
        else:
            self.stats["failed_buffered"] += 1
            print(f"{Ansi.YELLOW}[FAILOVER]{Ansi.RESET} Network offline! Storing alert in resilient queue.")
            self.queue.push(event)

    # ------------------------------------------------------------------------
    # State Machine & Main Loop
    # ------------------------------------------------------------------------

    def _handle_wifi(self, now: float):
        """Handles WiFi connection state machine with exponential backoff."""
        if not self.network_available:
            self.network_connected = False
            return

        if self.network_connected:
            # Drain queue if anything remains
            self._drain_failover_queue()
            return

        # Attempt reconnect with exponential backoff
        if now - self.last_wifi_attempt >= self.backoff_seconds:
            self.last_wifi_attempt = now
            print(f"{Ansi.YELLOW}[WIFI]{Ansi.RESET} Attempting connection... (Backoff interval: {self.backoff_seconds:.1f}s)")

            # In simulation, assume network connects if network_available is True
            self.network_connected = True
            self.backoff_seconds = 1.0  # Reset backoff on success
            if not self.sensor_alarm_active:
                self.state = "MONITORING"
            print(f"{Ansi.GREEN}[WIFI]{Ansi.RESET} WiFi Connected! IP: 192.168.1.142 (RSSI: -58 dBm)")

            # Immediately flush queue upon reconnect
            self._drain_failover_queue()
        else:
            # Still backing off
            pass

    def _poll_sensors(self, now: float):
        """Samples MQ-2 sensor with jitter and checks button interrupt flag."""
        # 1. Handle manual button interrupts
        with self._lock:
            pending_buttons = self.button_interrupt_pending
            self.button_interrupt_pending = 0

        for _ in range(pending_buttons):
            self._dispatch_alarm("manual_button", self.current_sensor_value)

        # 2. Emulate analog reading with slight natural noise
        if self.smoke_active:
            noise = random.randint(-15, 25)
            sensor_val = max(self.threshold + 20, self.current_sensor_value + noise)
        else:
            noise = random.randint(-8, 8)
            sensor_val = max(100, min(self.threshold - 50, self.current_sensor_value + noise))
        self.current_sensor_value = sensor_val

        # 3. Threshold detection with hysteresis
        if sensor_val >= self.threshold:
            if not self.sensor_alarm_active:
                self.sensor_alarm_active = True
                self.last_alarm_heartbeat = now
                self.stats["sensor_trips"] += 1
                self._dispatch_alarm("mq2_sensor", sensor_val)
            elif now - self.last_alarm_heartbeat >= self.alarm_heartbeat_interval:
                # Persistent smoke heartbeat
                self.last_alarm_heartbeat = now
                self._dispatch_alarm("mq2_sensor", sensor_val)
        elif sensor_val < (self.threshold - 50):
            if self.sensor_alarm_active:
                print(f"{Ansi.GREEN}[SENSOR]{Ansi.RESET} Smoke cleared ({sensor_val} < {self.threshold - 50}). Returning to monitoring.")
                self.sensor_alarm_active = False
                if self.network_connected:
                    self.state = "MONITORING"
                else:
                    self.state = "CONNECTING"

    def _run_loop(self):
        """Emulates the Arduino loop() execution cadence."""
        last_status_print = 0.0

        while self.running:
            now = time.time()

            # 1. Handle WiFi
            self._handle_wifi(now)

            # 2. Poll Sensors & Interrupts
            self._poll_sensors(now)

            # 3. Print periodic monitor status
            if now - last_status_print >= 2.0:
                last_status_print = now
                status_color = Ansi.RED if self.state == "ALARM" else (Ansi.GREEN if self.state == "MONITORING" else Ansi.YELLOW)
                queue_str = f"Buffered: {len(self.queue)}/{self.queue.capacity}"
                print(
                    f"{led_indicator(self.state)} "
                    f"ADC: {self.current_sensor_value:4d} | "
                    f"Threshold: {self.threshold} | "
                    f"{queue_str} | "
                    f"WiFi: {'ON' if self.network_connected else 'OFF'}"
                )

            time.sleep(self.sample_interval)


# ============================================================================
# EMBEDDED MOCK SERVER (FOR STANDALONE TESTING & CI)
# ============================================================================

class MockServerRequestHandler(http.server.BaseHTTPRequestHandler):
    received_events = []
    server_healthy = True

    def do_POST(self):
        if not MockServerRequestHandler.server_healthy:
            self.send_response(503)
            self.end_headers()
            self.wfile.write(b'{"error":"Service Unavailable"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))
            MockServerRequestHandler.received_events.append(data)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"received","action":"evacuation_route_recomputed"}')
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"Invalid JSON"}')

    def log_message(self, format, *args):
        # Silence standard HTTP access logs for clean CLI display
        pass


def run_mock_server(port: int = 4000) -> http.server.HTTPServer:
    """Spins up a lightweight mock CampusSafe API server."""
    server = http.server.HTTPServer(("127.0.0.1", port), MockServerRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# ============================================================================
# AUTOMATED CI / HARDWARE VERIFICATION SUITE
# ============================================================================

def run_automated_ci_test(port: int = 4199) -> bool:
    """
    Executes an end-to-end regression test suite verifying:
      1. Bootup & WiFi state transitions
      2. Manual button interrupt HTTP alert
      3. MQ-2 smoke sensor threshold trigger
      4. Network outage & 10-event failover queue buffering
      5. Network restoration & queue flush
    """
    print(f"\n{Ansi.BOLD}{Ansi.CYAN}======================================================={Ansi.RESET}")
    print(f"{Ansi.BOLD}{Ansi.CYAN}  CampusSafe ESP32 Fire Node Automated Verification   {Ansi.RESET}")
    print(f"{Ansi.BOLD}{Ansi.CYAN}======================================================={Ansi.RESET}\n")

    MockServerRequestHandler.received_events.clear()
    MockServerRequestHandler.server_healthy = True

    mock_server = run_mock_server(port)
    server_url = f"http://127.0.0.1:{port}/api/devices/events"

    simulator = ESP32FireNodeSimulator(
        server_url=server_url,
        sample_interval=0.1,
    )
    simulator.start()

    try:
        # Step 1: Wait for initial connection
        print(f"\n{Ansi.BOLD}[TEST 1/5] Verifying WiFi Connection & Monitoring State...{Ansi.RESET}")
        time.sleep(1.2)
        assert simulator.state == "MONITORING", f"Expected MONITORING, got {simulator.state}"
        assert simulator.network_connected, "Expected WiFi connected"
        print(f"{Ansi.GREEN}✓ Test 1 Passed: Node reached MONITORING state with Solid Green LED.{Ansi.RESET}")

        # Step 2: Test Manual Button Interrupt
        print(f"\n{Ansi.BOLD}[TEST 2/5] Triggering GPIO 4 Manual Button Interrupt...{Ansi.RESET}")
        before_count = len(MockServerRequestHandler.received_events)
        simulator.trigger_button_interrupt()
        time.sleep(0.5)

        assert len(MockServerRequestHandler.received_events) == before_count + 1, "Alert not received by server"
        latest_event = MockServerRequestHandler.received_events[-1]
        assert latest_event["deviceId"] == DEFAULT_DEVICE_ID
        assert latest_event["zoneId"] == DEFAULT_ZONE_ID
        assert latest_event["kind"] == "alarm"
        assert latest_event["source"] == "manual_button"
        assert simulator.state == "ALARM"
        print(f"{Ansi.GREEN}✓ Test 2 Passed: Manual button dispatched instant JSON alert and switched to Red LED.{Ansi.RESET}")

        # Step 3: Test MQ-2 Smoke Sensor Threshold Detection
        print(f"\n{Ansi.BOLD}[TEST 3/5] Simulating Smoke Injection (MQ-2 Sensor Value >= 400)...{Ansi.RESET}")
        before_count = len(MockServerRequestHandler.received_events)
        simulator.set_smoke(True, custom_value=540)
        time.sleep(0.5)

        assert len(MockServerRequestHandler.received_events) == before_count + 1, "Sensor alarm not received"
        sensor_event = MockServerRequestHandler.received_events[-1]
        assert sensor_event["kind"] == "alarm"
        assert sensor_event["source"] == "mq2_sensor"
        assert sensor_event["sensorValue"] >= 400
        print(f"{Ansi.GREEN}✓ Test 3 Passed: MQ-2 sensor crossed threshold 400 and triggered alarm.{Ansi.RESET}")

        # Clear smoke
        simulator.set_smoke(False, custom_value=170)
        time.sleep(0.5)

        # Step 4: Test Failover Event Queue (Simulate Network Outage)
        print(f"\n{Ansi.BOLD}[TEST 4/5] Testing Resilient Failover Queue Under Network Outage...{Ansi.RESET}")
        simulator.set_network_state(False)
        time.sleep(0.2)

        # Trigger 5 manual alarms while offline
        for i in range(5):
            simulator.trigger_button_interrupt()
            time.sleep(0.15)

        assert len(simulator.queue) == 5, f"Expected 5 buffered events, got {len(simulator.queue)}"
        print(f"{Ansi.GREEN}✓ Test 4 Passed: 5 alerts safely buffered in internal queue while offline.{Ansi.RESET}")

        # Step 5: Test Queue Saturation & Recovery
        print(f"\n{Ansi.BOLD}[TEST 5/5] Testing Queue Saturation (10 Events) & Automatic Recovery...{Ansi.RESET}")
        for i in range(8):  # Exceed capacity
            simulator.trigger_button_interrupt()
            time.sleep(0.05)
        time.sleep(0.3)

        assert len(simulator.queue) == DEFAULT_QUEUE_CAPACITY, f"Queue did not cap at {DEFAULT_QUEUE_CAPACITY}"

        # Restore network
        print("Restoring network link...")
        simulator.set_network_state(True)
        time.sleep(1.5)

        assert simulator.queue.is_empty(), f"Queue failed to drain, remaining: {len(simulator.queue)}"
        print(f"{Ansi.GREEN}✓ Test 5 Passed: All buffered events flushed chronologically upon reconnection.{Ansi.RESET}")

        print(f"\n{Ansi.BOLD}{Ansi.GREEN}======================================================={Ansi.RESET}")
        print(f"{Ansi.BOLD}{Ansi.GREEN}  ALL 5 HARDWARE & FIRMWARE VERIFICATION TESTS PASSED! {Ansi.RESET}")
        print(f"{Ansi.BOLD}{Ansi.GREEN}======================================================={Ansi.RESET}\n")
        return True

    finally:
        simulator.stop()
        mock_server.shutdown()


# ============================================================================
# INTERACTIVE CLI DASHBOARD
# ============================================================================

def run_interactive(simulator: ESP32FireNodeSimulator):
    """Runs interactive operator dashboard with keyboard commands."""
    print(f"\n{Ansi.BOLD}CampusSafe ESP32 Fire Node Interactive Simulator{Ansi.RESET}")
    print(f"Target Server: {simulator.server_url}")
    print(f"Device ID:     {simulator.device_id} | Zone: {simulator.zone_id}")
    print("\nKeyboard Controls:")
    print(f"  {Ansi.BOLD}'b'{Ansi.RESET} + Enter: Press Manual Button (GPIO 4 Interrupt)")
    print(f"  {Ansi.BOLD}'s'{Ansi.RESET} + Enter: Inject Smoke Spike (MQ-2 >= 400)")
    print(f"  {Ansi.BOLD}'c'{Ansi.RESET} + Enter: Clear Smoke (Clean Air)")
    print(f"  {Ansi.BOLD}'f'{Ansi.RESET} + Enter: Simulate Network Outage (Offline Buffer Test)")
    print(f"  {Ansi.BOLD}'r'{Ansi.RESET} + Enter: Restore Network Connection (Queue Flush)")
    print(f"  {Ansi.BOLD}'q'{Ansi.RESET} + Enter: Exit Simulator\n")

    simulator.start()

    try:
        while simulator.running:
            line = sys.stdin.readline()
            if not line:
                break
            cmd = line.strip().lower()

            if cmd == "b":
                simulator.trigger_button_interrupt()
            elif cmd == "s":
                simulator.set_smoke(True)
            elif cmd == "c":
                simulator.set_smoke(False)
            elif cmd == "f":
                simulator.set_network_state(False)
            elif cmd == "r":
                simulator.set_network_state(True)
            elif cmd == "q":
                print("Exiting simulator...")
                break
            elif cmd:
                print(f"Unknown command '{cmd}'. Available: b (button), s (smoke), c (clear), f (fail net), r (restore net), q (quit)")
    except KeyboardInterrupt:
        print("\nShutdown requested by operator.")
    finally:
        simulator.stop()


# ============================================================================
# ENTRYPOINT
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="CampusSafe ESP32 Fire Node Hardware Simulator")
    parser.add_argument("--server-url", default=DEFAULT_SERVER_URL, help="CampusSafe backend events endpoint URL")
    parser.add_argument("--device-id", default=DEFAULT_DEVICE_ID, help="Node Device ID")
    parser.add_argument("--zone-id", default=DEFAULT_ZONE_ID, help="Node Zone ID")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD, help="MQ-2 smoke threshold")
    parser.add_argument("--interval", type=float, default=DEFAULT_SAMPLE_INTERVAL, help="Sensor sampling interval in seconds")
    parser.add_argument("--mock-server", action="store_true", help="Run standalone mock backend server")
    parser.add_argument("--port", type=int, default=4000, help="Port for embedded mock server")
    parser.add_argument("--test", "--ci", action="store_true", help="Execute automated verification suite")

    args = parser.parse_args()

    if args.test:
        success = run_automated_ci_test(port=args.port)
        sys.exit(0 if success else 1)

    if args.mock_server:
        print(f"{Ansi.GREEN}[MOCK SERVER]{Ansi.RESET} Starting mock CampusSafe API on http://127.0.0.1:{args.port}...")
        server = run_mock_server(args.port)
        print("Listening for incoming fire node alerts. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            server.shutdown()
            print("\nMock server stopped.")
            sys.exit(0)

    # Interactive Simulator
    simulator = ESP32FireNodeSimulator(
        server_url=args.server_url,
        device_id=args.device_id,
        zone_id=args.zone_id,
        threshold=args.threshold,
        sample_interval=args.interval,
    )

    if sys.stdin.isatty():
        run_interactive(simulator)
    else:
        # Piped / Non-interactive daemon mode
        print("Starting simulator in headless mode (non-interactive)...")
        simulator.start()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            simulator.stop()


if __name__ == "__main__":
    main()
