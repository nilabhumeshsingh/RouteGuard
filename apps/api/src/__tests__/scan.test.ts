import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { scanStore } from "../routes/scan.routes.js";

describe("WiFi Scanner Ingest Endpoints", () => {
  const app = createApp();

  beforeEach(() => {
    scanStore.clear();
  });

  describe("POST /api/scan", () => {
    it("stores a scan payload in-memory and returns count", async () => {
      const payload = {
        deviceId: "android-scanner-01",
        timestamp: 1788880000000,
        aps: [
          { bssid: "34:2c:c4:a1:02:11", rssi: -55, ssid: "MUJ-WiFi", freq: 2412, channel: 1 },
          { bssid: "34:2c:c4:a1:02:12", rssi: -62, ssid: "MUJ-WiFi", freq: 5180, channel: 36 }
        ]
      };

      const res = await request(app)
        .post("/api/scan")
        .send(payload)
        .set("Content-Type", "application/json");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, count: 2 });
      expect(scanStore.has("android-scanner-01")).toBe(true);
    });

    it("rejects invalid request without deviceId", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ aps: [] })
        .set("Content-Type", "application/json");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/scan/:deviceId", () => {
    it("returns latest scan for that deviceId", async () => {
      const payload = {
        deviceId: "esp32-node-b1",
        timestamp: 1788881234567,
        aps: [
          { bssid: "aa:bb:cc:dd:ee:01", rssi: -45, ssid: "MUJ-Secure", freq: 5200, channel: 40 }
        ]
      };

      await request(app).post("/api/scan").send(payload);

      const res = await request(app).get("/api/scan/esp32-node-b1");
      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe("esp32-node-b1");
      expect(res.body.timestamp).toBe(1788881234567);
      expect(res.body.aps.length).toBe(1);
      expect(res.body.aps[0].bssid).toBe("aa:bb:cc:dd:ee:01");
      expect(res.body).toHaveProperty("receivedAt");
    });

    it("returns 404 for unknown deviceId", async () => {
      const res = await request(app).get("/api/scan/nonexistent-device");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "no scan" });
    });
  });

  describe("GET /api/scanner/status", () => {
    it("returns all known deviceIds with last seen time and apCount", async () => {
      await request(app).post("/api/scan").send({
        deviceId: "dev-A",
        timestamp: 1000,
        aps: [{ bssid: "11:11:11:11:11:11", rssi: -60 }]
      });

      await request(app).post("/api/scan").send({
        deviceId: "dev-B",
        timestamp: 2000,
        aps: [
          { bssid: "22:22:22:22:22:22", rssi: -50 },
          { bssid: "33:33:33:33:33:33", rssi: -70 }
        ]
      });

      const res = await request(app).get("/api/scanner/status");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);

      const devA = res.body.find((d: any) => d.deviceId === "dev-A");
      const devB = res.body.find((d: any) => d.deviceId === "dev-B");

      expect(devA).toBeDefined();
      expect(devA.apCount).toBe(1);
      expect(typeof devA.lastSeen).toBe("number");

      expect(devB).toBeDefined();
      expect(devB.apCount).toBe(2);
      expect(typeof devB.lastSeen).toBe("number");
    });
  });
});
